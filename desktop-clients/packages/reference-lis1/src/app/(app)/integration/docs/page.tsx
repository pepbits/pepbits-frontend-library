'use client';
import { API_URL } from '../../../../lib/api';
import { Card, PageHeader } from '../../../../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


const Code = ({ children }: { children: string }) => <pre className="overflow-x-auto rounded border border-line bg-[#0F1720] p-3 font-mono text-xs leading-relaxed text-[#D6E2EA]">{children}</pre>;

export default function ApiGuide() {
 const referenceT = useReferenceLocalization().t;

  const A = API_URL;
  return (
    <div className="max-w-4xl">
      <PageHeader title={referenceT("Integration API guide")} subtitle={referenceT("Endpoints for hospital systems, instrument middleware and reference labs. Each party authenticates with the API key configured on its master record (x-api-key header).")} />
      <div className="space-y-4">
        <Card title={referenceT("1 · External system sends an order (HIS / EMR)")}>
          <p className="mb-2 text-sm text-ink-soft"><ReferenceText message="Key:" /> <b><ReferenceText message="Masters → External systems → API key" /></b><ReferenceText message=". Test codes are LIS test or profile codes. Re-sending the same externalOrderNo is idempotent. Unknown doctors are created automatically." /></p>
          <Code>{referenceT("curl -X POST {value0}/integration/orders \\\n  -H \"x-api-key: <external system key>\" -H \"Content-Type: application/json\" \\\n  -d '{\n    \"externalOrderNo\": \"HIS-1001\",\n    \"priority\": \"ROUTINE\",\n    \"patient\": { \"externalPatientId\": \"P77\", \"firstName\": \"Ali\", \"lastName\": \"Khan\",\n                 \"dob\": \"1970-01-01\", \"gender\": \"M\" },\n    \"doctor\":  { \"code\": \"DR1\", \"name\": \"Dr House\" },\n    \"tests\":   [\"TSH\", \"GLUF\"],\n    \"clinicalNotes\": \"Fatigue\"\n  }'", {value0: A})}</Code>
          <p className="my-2 text-sm text-ink-soft"><ReferenceText message="Status and results can be polled; signed results are also pushed to the system&apos;s result callback URL (JSON, FHIR R4 Bundle or HL7 ORU) when auto-publish is on." /></p>
          <Code>{referenceT("curl {value0}/integration/orders/HIS-1001/status  -H \"x-api-key: <key>\"\ncurl \"{value1}/integration/orders/HIS-1001/results?format=FHIR\" -H \"x-api-key: <key>\"   # JSON | FHIR | HL7", {value0: A, value1: A})}</Code>
        </Card>
        <Card title={referenceT("2 · Middleware receives orders")}>
          <p className="mb-2 text-sm text-ink-soft"><ReferenceText message="On accessioning, each test is routed to the highest-priority active analyzer mapping and one ORDER message per analyzer is created." /> <b><ReferenceText message="PUSH" /></b> <ReferenceText message="middleware receives it by HTTP POST at its order endpoint (JSON or HL7 ORM^O01)." /> <b><ReferenceText message="PULL" /></b> <ReferenceText message="middleware polls:" /></p>
          <Code>{referenceT("curl {value0}/automation/middleware/orders -H \"x-api-key: <middleware inbound key>\"\n# returns pending order messages and marks them SENT", {value0: A})}</Code>
        </Card>
        <Card title={referenceT("3 · Middleware posts results")}>
          <p className="mb-2 text-sm text-ink-soft"><ReferenceText message="Accepts JSON, HL7 v2 ORU^R01 (MSH-3 = analyzer code, OBR-3 = sample barcode, OBX-3 = analyzer parameter code) or ASTM E1394 (H-5 analyzer, O-3 specimen, R-3 ^^^code). Codes are translated through" /> <b><ReferenceText message="Analyzer parameter mappings" /></b> <ReferenceText message="with the configured conversion factor." /></p>
          <Code>{referenceT("curl -X POST {value0}/automation/results -H \"x-api-key: <middleware inbound key>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{ \"analyzerCode\": \"HEM01\", \"sampleNo\": \"S2609300001\",\n        \"results\": [ { \"code\": \"HGB\", \"value\": 13.2 }, { \"code\": \"WBC\", \"value\": 7.1 } ] }'\n\ncurl -X POST {value1}/automation/results -H \"x-api-key: <key>\" -H \"Content-Type: application/hl7-v2\" \\\n  --data-binary $'MSH|^~\\\\&|CHEM01|LAB|LIS|LAB|20260930120000||ORU^R01|1|P|2.5\\rOBR|1||S2609300002\\rOBX|1|NM|CREA||0.9|mg/dL'", {value0: A, value1: A})}</Code>
        </Card>
        <Card title={referenceT("4 · Reference lab returns outsourced results")}>
          <p className="mb-2 text-sm text-ink-soft"><ReferenceText message="Key:" /> <b><ReferenceText message="Masters → External labs → inbound API key" /></b><ReferenceText message=". When a shipment is dispatched the manifest is POSTed to the lab&apos;s manifest endpoint (if configured)." /></p>
          <Code>{referenceT("curl -X POST {value0}/outsource/results -H \"x-api-key: <reference lab key>\" \\\n  -H \"Content-Type: application/json\" \\\n  -d '{ \"sampleNo\": \"S2609300002\", \"testCode\": \"VITD\",\n        \"results\": [ { \"code\": \"VITD\", \"value\": \"18\" } ], \"reportedBy\": \"RefLab\" }'", {value0: A})}</Code>
        </Card>
      </div>
    </div>
  );
}
