# LIS backend (NestJS + SQLite)

REST API, integration engine and result-delivery outbox for the Central LIS. See the top-level `README.md` for the overall design and workflow.

## Run

```bash
cp .env.example .env
npm install
npm run build
npm start            # production build
npm run dev          # watch mode
npm run reset-db     # delete data/ so the next start re-seeds
npm run simulate     # generate a realistic day of traffic through the API
npm run e2e          # end-to-end checks (run against an empty database)
```

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 4000 | HTTP(S) port; all routes are under `/api` |
| `DB_PATH` | data/lis.db | SQLite file (created and seeded on first start) |
| `MLLP_PORT` | 2575 | HL7 v2 over TCP/MLLP listener; `0` disables it |
| `ASTM_PORT` | 2576 | ASTM E1381/E1394 TCP listener; `0` disables it |
| `CORS_ORIGIN` | http://localhost:3000 | Comma-separated allowed origins for the web client |
| `DISPATCH_INTERVAL_MS` | 10000 | How often queued pushes (results, TCP work orders) are sent |
| `TLS_CERT`, `TLS_KEY` | – | PEM files; when both are set the API serves HTTPS |

## Code layout

```
src/
  main.ts                     bootstrap, body parsers (JSON, FHIR JSON, HL7/ASTM text), CORS, optional TLS
  app.module.ts               controllers and providers, global auth guard
  db/                         schema (masters generated from the registry + transactional tables), seed, Db helper
  masters/registry.ts         one declaration per master → table, validated CRUD API and generic UI
  masters/masters.ts          /api/masters/*
  auth/                       login / session tokens (12 h), roles
  patients/ orders/ samples/  front office, billing, collection, accession, rejection, outsourcing
  results/                    ranges and flags, delta, calculated values, auto-verify, validate, sign, amend, addendum, print data
  integration/codecs.ts       HL7 v2 and ASTM parsing/building, MLLP and E1381 framing
  integration/transport.ts    MLLP and ASTM servers/clients, HTTPS push
  integration/inbound.service.ts orders, results, host queries and ACKs from every protocol
  integration/outbound.service.ts analyzer work orders, referrals, result publication outbox and dispatcher
  dashboard/                  KPIs, TAT monitor, reagent stock, audit
tools/                        simulator and end-to-end scripts (use the public API only)
```

## API overview

Authenticated routes need `Authorization: Bearer <token>` from `POST /api/auth/login`. Role checks are applied per action; `ADMIN` can do everything.

| Area | Routes |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| Masters | `GET /masters/meta`, `GET/PUT /masters/settings/all`, `GET /masters/:key` (filters: any field, `q`, `sort`, `dir`, `page`, `pageSize`), `GET /masters/:key/options`, `GET/POST/PUT/DELETE /masters/:key[/:id]` |
| Patients | `GET/POST /patients`, `GET/PUT /patients/:id`, `GET /patients/:id/cumulative` |
| Orders and billing | `GET/POST /orders`, `GET /orders/:id`, `POST /orders/:id/items`, `POST /orders/:id/bill`, `POST /orders/items/:itemId/cancel`, `GET /billing`, `GET /billing/:id`, `POST /billing/:id/payments` |
| Samples | `GET /samples/pending-collection`, `POST /samples/collect`, `POST /samples/receive`, `GET /samples`, `GET /samples/:id`, `GET /samples/:id/label`, `POST /samples/:id/reject`, `PUT /samples/:id/storage` |
| Outsourcing | `GET /outsource/pending`, `GET/POST /outsource/shipments`, `GET/PUT /outsource/shipments/:id` |
| Results | `GET /results/worklist`, `GET /results/sample/:sampleId`, `POST /results/item/:itemId`, `POST /results/validate`, `POST /results/send-back`, `GET /results/signing-queue`, `POST /results/sign`, `POST /results/item/:id/amend`, `POST /results/item/:id/addendum`, `GET /results/item/:id` |
| Reports | `GET /reports`, `GET /reports/version/:id`, `GET /reports/order/:orderId/print?itemIds=&preview=&templateId=` |
| Critical values | `GET /critical`, `POST /critical/:id/notify` |
| Dashboard, stock, audit | `GET /dashboard`, `GET /dashboard/tat`, `GET /inventory/reagents`, `GET/POST /inventory/transactions`, `GET /audit` |
| Integration monitoring | `GET /integration/messages[/:id]`, `POST /integration/messages/:id/reprocess`, `GET /integration/publications[/:id]`, `POST /integration/publications/:id/retry`, `GET /integration/instrument-orders`, `POST /integration/samples/:id/resend`, `GET /integration/endpoints`, `POST /integration/console/mllp` |

List endpoints return `{ data, total, page, pageSize }`.

## Integration endpoints for external systems

These routes are authenticated with the `x-api-key` header (or `?apiKey=`) instead of a user session. A key belongs either to a client facility (`External facilities → API key`) or to an interface (`Interface engines → Auth secret`).

| Purpose | Request | Body / reply |
|---|---|---|
| Send HL7 v2 | `POST /api/integration/inbound/hl7` | ER7 text (`\r` or newline separated); reply is an HL7 ACK (AA / AE / AR) |
| Send ASTM | `POST /api/integration/inbound/astm` | E1394 records, framed or unframed; host queries return the work order |
| Send FHIR R4 | `POST /api/integration/inbound/fhir` | Bundle or single resource; reply is an OperationOutcome |
| Send JSON | `POST /api/integration/inbound/json` | See the JSON formats below |
| Middleware worklist | `GET /api/integration/worklist`, then `POST /api/integration/worklist/ack {ids}` | Queued work orders for the key's interface |
| Host query | `GET /api/integration/query?specimen=S26…` | Work order in the interface protocol, 404 if none |
| Pull results | `GET /api/integration/results[?since=&orderNo=&includeAcked=1&limit=]` | `{ results: [{ publicationId, event, reportVersion, format, payload, … }] }` |
| Acknowledge results | `POST /api/integration/results/ack {ids}` | `{ acknowledged }` |

Every inbound message gets an `x-message-id` response header that matches the message log.

### JSON formats

```json
{ "type": "ORDER", "orderNo": "H-1001", "action": "NEW", "priority": "URGENT",
  "patient": { "id": "MRN-at-hospital", "nationalId": "…", "firstName": "Priya", "lastName": "Nair", "dob": "1968-02-19", "gender": "F" },
  "encounter": { "id": "VISIT-9", "type": "ER" },
  "tests": [ { "code": "LIP01", "lineNo": "1", "specimenId": "TUBE-77" } ] }
```

```json
{ "type": "RESULT", "sampleNo": "S260000123", "instrument": "c311",
  "results": [ { "code": "GLU", "value": "96", "unit": "mg/dL", "comment": "" } ] }
```

### HL7 v2 conventions

**Orders (ORM^O01 / OML^O21 / OML^O33)**

| Segment / field | Used for |
|---|---|
| PID-3 | Hospital patient ID (type MR/PI) and national ID (type NI/SS/NNIND) |
| PID-5, PID-7, PID-8 | Name, date of birth, sex |
| PV1-2, PV1-3, PV1-19 | Patient class, location, visit number |
| ORC-1 | `NW` new, `CA` cancel |
| ORC-2 / OBR-2 | Placer number for each line |
| ORC-4 | Placer group number; lines sharing it form one order |
| ORC-7.6, OBR-5 or TQ1-9 | Priority: `S` STAT, `A` urgent |
| OBR-4 | Test code (hospital code, our code or LOINC) |
| OBR-15.4 | Body site |
| SPM-2 or OBR-18 | Specimen barcode |
| SPM-17 | Collection time |

**Results (ORU^R01)**

| Segment / field | Used for |
|---|---|
| OBR-3, OBR-2 or SPM-2 | Sample number |
| OBX-3 | Result code, mapped through Analyzer test mapping |
| OBX-5 | Value; SN (e.g. `<^5`) and CWE are supported |
| OBX-11 | Result status; X / D / W are ignored |
| OBX-18 | Instrument ID |
| NTE | Result comment, taken from the NTE following the OBX |

**Outgoing results** are ORU^R01:

- ORC-1 `RE`; OBR-25 and OBX-11 are `F` for final and `C` for corrected.
- The client's order and patient numbers are echoed back.
- NTE segments carry the amendment reason and any addenda.
