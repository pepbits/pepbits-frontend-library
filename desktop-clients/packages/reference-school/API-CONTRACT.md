# @pepbits/reference-school API contract

Status: contract for the host/demo backend, written before the client port was finished so the backend can be built in parallel. Source: Scholaris reference `src/app/api/**` and every `useApi`/`api.*` call in `src/app/(app)/**` and `src/components/**`. The backend owns all data (see "Data ownership"). It adds `/session`, `/quiz-attempts`, `/settings*`, `/leave-requests`, `/reservations`, `/invoices/reminders` and `/contacts`, which the source did not have (the source faked those actions with toasts or browser storage).

## Transport

- Every request goes through `useSchoolApi()` → `host.request<T>("/api" + path, init)`. The host namespaces it, for example as `/reference-modules/school/api/...`. The module never calls `fetch`, never reads `process.env` and never holds a module-global client.
- Writes send `Content-Type: application/json` with a JSON body. Methods: `GET`, `POST`, `PATCH`, `DELETE`.
- **Success envelope:** `{ "data": T }`. Lists add `total`: `{ "data": T[], "total": number }`. The attendance roster and student-month responses also have sibling keys (see below).
- **Error:** a non-2xx response with `{ "error": string }`. `host.request` must reject with an `Error` whose `message` is that string; pages show it verbatim, for example "No copies available. Place a reservation instead."
- **Authority:** the server resolves tenant, branch, user and role from authentication. Query values such as `teacherId`, `studentId`, `owner` or `role` are filters/routing hints only. The server must scope or reject them. Examples: a parent may only request their own children, and a student only their own `studentId`.

## Generic resources

`RESOURCE` ∈ `students | teachers | classes | subjects | timetable | assignments | exams | quizzes | live | books | issues | invoices | notices | events | admissions | threads`. Row types are in `src/lib/types.ts` (`Student`, `Teacher`, `ClassRoom`, `Subject`, `TimetableSlot`, `Assignment`, `Exam`, `Quiz`, `LiveSession`, `Book`, `BookIssue`, `FeeInvoice`, `Notice`, `CalendarEvent`, `Admission`, `Thread`).

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/{RESOURCE}?field=v1,v2&q=&sort=&order=asc\|desc&limit=&page=&pageSize=` | — | `{data: Row[], total}` |
| GET | `/{RESOURCE}/{id}` | — | `{data: Row}` or 404 `{error:"Not found"}` |
| POST | `/{RESOURCE}` | partial row | 201 `{data: Row}` (server assigns `id`) |
| PATCH | `/{RESOURCE}/{id}` | partial row | `{data: Row}` |
| DELETE | `/{RESOURCE}/{id}` | — | `{data:{id}}` |

Query semantics (source `_lib.query`) work as follows:
- Every non-reserved key filters by equality. A comma list matches any of the values, and array fields such as `subjectIds` match on any element.
- Empty values and `all` are ignored.
- `q` matches a case-insensitive substring of any string field.
- `sort`/`order` sort by string comparison.
- `limit` truncates the list, and `page`/`pageSize` (default 20) slice it.
- `total` is the count before `limit`/paging.

`live` rows are materialized on read. `status` is `Scheduled`/`Live`/`Ended` from `start` + `durationMin` against the server clock. `attendees` is 0 while Scheduled. Rows are sorted by `start`.

### Server-side create/patch rules (retain these semantics)

| Resource | Rule |
| --- | --- |
| POST `students` | Sets `admissionNo` `NB/{year}/{5000+n}`, `rollNo` = class count+1, `status:"Active"`, `attendancePct:100`, `gpa:0`, `feeStatus:"Due"`, `ability:0.75` and `joinedOn` = today. It increments the class `strength`. |
| POST `teachers` | Sets `empId` `NB-EMP-{2100+n}`, `status:"Active"`, `rating:0` and `weeklyPeriods:0`. |
| POST `books` | The client sends only authored fields (`title, author, isbn, category, publisher, year, copies, shelf`). The server initializes `available = copies`, `rating = 0` and `cover`. |
| POST `classes` | The client sends `grade, section, name, room, capacity, stream, classTeacherId`. The server initializes `strength = 0` and `avgScore = 0`. |
| POST `quizzes` | The client sends the quiz with `questions`, `shuffle` and `revealAnswers`. The server initializes `attempts = 0` and `avgScore = 0`. |
| POST `assignments` | The client sends authored fields, `assignedOn`, `status` and `attachments`. The server initializes `submitted = 0`, `graded = 0` and `total` (the class roster size). |
| POST `issues` | Body `{bookId, memberId, memberName, memberType, issuedOn, dueOn}`. Returns 404 "Book not found" or 409 "No copies available. Place a reservation instead." if `available<1`. Otherwise it decrements `available` and sets `bookTitle`, `returnedOn:null`, `status:"Issued"` and `fine:0`. |
| POST `live` | Sets `attendees:0` and `capacity:40`. The body includes `start` (ISO) and `durationMin`. |
| POST `admissions` | Sets `applicationNo` `APP-27-{400+n}`, `stage:"Applied"`, `score:null` and `appliedOn` = today. |
| PATCH `invoices/{id}` `{payAmount:number, method:string}` | Returns the updated invoice, optionally with `receiptNo` (the receipt the server issued) and `receiptSent: true` (only when the receipt was actually sent to the guardian). The client shows only these values and never invents a receipt number or an email claim. Sets `paid = min(amount, paid+payAmount)`, `status` Paid/Partial, `lastPaymentOn` = today and `method`. It recomputes the student's `feeStatus` (Overdue > Partial > Due > Paid). |
| PATCH `issues/{id}` `{action:"return"}` | Returns the canonical returned issue, including its `fine`; the client shows that fine and never substitutes its own overdue estimate. Stock is re-read with `GET /books` after a return or an issue; the client never adjusts `available` itself, so an idempotent return must leave stock unchanged on the server. The server sets `status:"Returned"` and `returnedOn` = today, and increments book `available` only once. |
| PATCH other | Shallow merge of the body. |

Other generic calls the client makes:
- `PATCH /live/{id}` with `{status:"Ended"}`.
- `PATCH /threads/{id}` with `{unread: 0}` when a thread is opened (sending a message is described under "Other actions").
- `PATCH /timetable/{id}` with `{subjectId, teacherId, room}`.
- `PATCH /classes/{id}` with class fields.
- `PATCH /quizzes/{id}` with `{status}`.
- `PATCH /notices/{id}` with `{pinned}`.
- `PATCH /admissions/{id}` with `{stage}`.
- `PATCH /assignments/{id}` with `{status}`.
- `PATCH /students/{id}` and `PATCH /teachers/{id}` with profile fields.
- `DELETE /notices/{id}`.

## Session (new; replaces the source role chooser and `DEMO_USERS`)

`GET /session?role={candidate}` returns:

```ts
{ data: { role: "admin"|"teacher"|"student"|"parent"|"librarian"|"accountant";
          user: { id: string; name: string; title: string; email: string };   // school-domain id, e.g. "t-001", "s-1192"
          children: string[] } }                                            // parent: student ids; others: []
```

The client picks `candidate` only from `host.scope.roles` (see README, "Role trust") and never sends an untrusted role. The server must confirm that the authenticated user holds the role, and it must never map an unknown role to `admin`. The client rejects a response whose `role` is not one of its trusted candidates. It then shows an access state instead of a portal. `user.id` becomes the identity for filters, for example `/stats?role=teacher&id=`, `/issues?memberId=` and `/threads?owner=`. Parent child cards load `GET /students?id={children.join(",")}`.

## Reference data

| Method | Path | Response |
| --- | --- | --- |
| GET | `/meta` | `{data: {periods: Period[], days: string[], terms: Term[], today: {weekday, schoolDay, isWeekend}}}` |

The source returned `/meta` without the envelope. The client accepts both `{data: Meta}` and a bare `Meta`. `Term = {id:"UT1"\|"QTR"\|"UT2"\|"HY", name, max, status:"Completed"\|"Scheduled"}`. `weekday` is 0 for Monday. `schoolDay = weekday<5 ? weekday : 0`.

## Attendance

| Method | Path | Response / body |
| --- | --- | --- |
| GET | `/attendance?classId=&date=YYYY-MM-DD` | `{data: AttendanceRow[], taken: boolean, trend: {date, pct}[] /*20 school days*/}` |
| GET | `/attendance?studentId=&month=YYYY-MM` | `{data: {date, status: "P"\|"A"\|"L"\|"E"\|null}[] /*every day of month*/, summary: {present, absent, late, excused, total} /*last 60 school days*/}` |
| POST | `/attendance` | body `{date, rows: {studentId, status}[]}` → `{data: {saved: number}}`; 400 `Expected { date, rows[] }` |

In the roster, a missing status defaults to `P`. `taken` is true when any row is stored for that date or the date is in the past. Weekends and future dates have a `null` status.

## Marks and report card

| Method | Path | Response / body |
| --- | --- | --- |
| GET | `/marks?classId=&term=` | `{data: {class: ClassRoom, term: Term, subjects: Subject[], students: {id, name, rollNo, admissionNo, marks: Record<subjectId, number\|null>}[]}}`; 404 `Unknown class or term` |
| POST | `/marks` | body `{term, entries: {studentId, subjectId, value: number\|null}[]}` → `{data:{saved}}`; 400 `Marks must be between 0 and {max}` |
| GET | `/report-card?studentId=` | `{data: {student, class, subjects, terms: ReportTerm[]}}` (`ReportTerm` in `src/components/shared/report-card.tsx`: term + `marks`, `classAvg`, `total`, `pct`, `grade`, `rank`, `outOf`) |

Exam subjects: the eight core subjects, plus `sub-eco` for grade 11 and above (core list: MAT, ENG, PHY, CHE, BIO, CSC, HIS, GEO). Scheduled terms return `null` marks.

## Submissions

| Method | Path | Response / body |
| --- | --- | --- |
| GET | `/submissions?assignmentId=` | `{data: Submission[]}` (one per class student) |
| GET | `/submissions?studentId=` | `{data: Submission[]}` (for that student's class assignments) |
| PATCH | `/submissions` | body `{assignmentId, studentId, text?}` submits. Status is Submitted or Late; a missing submission increments `assignment.submitted`. Body `{assignmentId, studentId, marks, feedback?}` grades: marks must be in `0..maxMarks` or a 400 `Marks must be between 0 and {max}` is returned; the first grade increments `graded`. Response: `{data: Submission}` |

## Dashboard statistics

`GET /stats?role={role}&id={userId}` returns `{data: …}`. Optional `trends` carries server-computed percentage changes against the previous period: for admin, `{students?, attendanceToday?}`; for accountant, `{collected?}`. A trend is shown only when present; the client has no built-in trend values. Shapes are the exported interfaces `AdminStats`, `TeacherStats`, `StudentStats`, `LibStats` and `AccStats` in `src/lib/contract.ts`. Parents call `role=student&id={childId}`. The server must check parent → child ownership. Derivations follow source `app/api/stats/route.ts`:
- **admin:** active-student attendance over the last 20 school days, invoice totals, fee collections by month, class `avgScore`, gender split, live now/upcoming, admissions per stage and library counts.
- **teacher:** today's schedule (the next Monday at the weekend), timetable class ids, home class and pending grading.
- **student:** schedule for the student's class, attendance over the last 60 days, Quarterly subject marks against the class average, open/unsubmitted assignments, scheduled exams, published quizzes, live sessions, open issues, invoices and class teacher.
- **librarian:** titles, copies, available, issued, overdue list, fines, stock by category, a 14-day issue/return trend, the 8 most recent issues and the 5 most popular titles.
- **accountant:** billed, collected, outstanding, overdue list, partial count, collection rate by class, payment methods, collections by month and the 8 most recent payments.

## Quizzes: questions, server grading and attempts (new; the source scored in the browser and kept attempts in `localStorage`)

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/quizzes/{id}` | — | `{data: Quiz}` metadata. It may include `questionCount`. For students it must not include `questions[].answer` or `explanation`. |
| GET | `/quizzes/{id}/questions` | — | `{data: QuizQuestion[]}`. Students receive `{id, text, options, points}` only. Staff and authors may receive `answer` and `explanation` (preview). |
| POST | `/quizzes/{id}/grade` | `{studentId?, answers: (number\|null)[], timeTaken: seconds, preview?: true}` | `{data: QuizAttempt}` scored by the server |
| GET | `/quiz-attempts?studentId=&quizId=` | — | `{data: QuizAttempt \| null}`, including its `review` |
| GET | `/quiz-attempts?studentId=` | — | `{data: QuizAttempt[]}` (the student's attempts, for the quiz list) |
| GET | `/question-bank?subjectId=` | — | `{data: QuizQuestion[]}` with `answer`/`explanation`. Authors (teacher/admin) only; 403 otherwise. Used by the quiz builder and live-room polls. |

`QuizAttempt = {studentId, quizId, score, total, answers, at, timeTaken, review: {answer, explanation?}[], preview?}`.
- The client sends only `answers`, `timeTaken`, and `studentId` (students) or `preview: true` (staff). It never sends a score and never needs an answer key.
- The server scores against its stored key and stores one attempt per student. A second attempt may be refused with 409.
- A preview is graded and returned but not stored.
- The key (`review`) is released only with a graded result.
- **Failure:** if the grade request fails, the client keeps the submitted answers on screen with **Retry grade**. A retry re-sends the identical request. The client shows a result only from a server response.
- `POST /quiz-attempts` from the earlier draft of this contract is **withdrawn**.

## Live classroom (new; the source simulated participants, chat, polls and votes in the browser)

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/live/{id}/room` | — | `{data: LiveRoomState}` (the client polls every 2 s while the room is open) |
| POST | `/live/{id}/actions` | `LiveRoomActionBody` | `{data: LiveRoomState}` |

`LiveRoomState = {people: {id, name, role, mic, cam, hand, speaking}[], messages: {id, from, text, at: epochMs, me?}[], poll: {q, options, answer?, votes, mine, open, n} | null, scores: Record<name, number>, recording, elapsed: seconds}`.
- `people` excludes the current user, whose tile is their real local camera.
- Omit `poll.answer` for students until the poll is closed (revealed).

`LiveRoomActionBody = {action, text?, index?, pollNumber?, raised?, enabled?, emoji?}`. Actions:
- `join` is sent from the lobby before entering, with `enabled` set to the microphone state.
- `leave` and `end` (end is for the host) are sent before navigating away. If the call fails, the user stays in the room.
- `message` carries `text`.
- `poll-launch` carries `index` (a question-bank index) and `pollNumber`.
- `poll-vote` carries `index` (the option) and `pollNumber`.
- `poll-close` (reveal) and `poll-end` carry `pollNumber`.
- `hand` carries `raised`. With `text: "*"` from a host, it lowers all hands.
- `recording` carries `enabled`.
- `mute` carries `enabled` for the user's own microphone. From a host, `text` set to a participant id toggles that participant, and `text: "*"` mutes everyone.
- `camera` carries `enabled`.
- `reaction` carries `emoji`.

The server authorizes the host-only actions: `end`, `poll-launch`, `poll-close`, `poll-end`, `recording`, and `mute`/`hand` with `text`.

This API exchanges room state only. No audio or video leaves the browser, and no media relay, recording storage or real-time transport is part of this module.

## Other actions (new; the source only showed a toast)

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/leave-requests` | `{studentId, from, to, reason}` | 201 `{data:{id}}` (attendance page, student/parent) |
| POST | `/reservations` | `{bookId, memberId}` | 201 `{data:{id}}` (library reserve or waitlist; the server decides which, based on `available`) |
| POST | `/invoices/reminders` | `{invoiceIds: string[]}` | `{data:{sent: number}}` (fees, "Remind all") |
| GET | `/contacts` | — | `{data: {name, role}[]}` (office recipients for new messages, such as the principal, school office, finance and library; teachers come from `/teachers`) |

Field notes:
- `POST /students` may omit `email`; the server then issues a school address. The source fabricated one on the client.
- `POST /quizzes` also sends the builder options `shuffle` and `revealAnswers` (booleans). The source collected them without saving them.
- `POST /teachers` is followed by `PATCH /classes/{homeClass}` `{classTeacherId}` when "Class teacher of" is chosen.
- `PATCH /threads/{id}` `{messages}` returns `{data: Thread}`. The client renders the returned thread, including any reply the server appends; a demo backend may append one of `DEMO_THREAD_REPLIES`. The client never fabricates replies. On failure, the draft and the earlier thread are kept.

## School profile and fee tariff (new; the source hardcoded both in the pages)

| Method | Path | Response |
| --- | --- | --- |
| GET | `/school-profile` | `{data: {name, short, product, year, campus, bankTransfer?: {account, routing}}}`. Loaded with the lookups; used by report cards, exams, fees, reports and settings. |
| GET | `/fee-structure` | `{data: {g, tuition, lab, library, activities, transport}[], policy: {siblingDiscountPct, lateFee, lateAfterDays}}` |

If the first lookup load fails (`/meta`, `/school-profile`, `/classes`, `/subjects` or `/teachers`), the module shows an error with retry instead of pages. There is no built-in fallback profile.

## Settings (new; replaces local-only toasts)

| Method | Path | Response / body |
| --- | --- | --- |
| GET | `/settings` | `{data: SchoolSettings}` |
| PATCH | `/settings` | body `Partial<Pick<SchoolSettings,"profile"\|"notifications"\|"twoStepVerification">>` → `{data: SchoolSettings}` |
| POST | `/settings/password` | body `{current, next, confirm}` → `{data: {updated: true}}`; 400/403 `{error}` |
| DELETE | `/settings/sessions/{id}` | `{data: {id}}` |

`SchoolSettings = {profile: {name, email, phone, language, timezone}, notifications: Record<string, [inApp: boolean, email: boolean, sms: boolean]>, twoStepVerification: boolean, sessions: {id, name, detail, current: boolean}[]}`. Presentation settings (theme, density, reduced motion) are **not** part of this endpoint. They go only through `host.preferenceHost.onPreferenceChange` and honour tenant locks.

## Attachments (new; the source showed "attached (demo)" toasts)

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/attachments` | `{name, type, content: base64, purpose: "assignment"\|"submission"\|"message"}` (JSON) | `{data: SchoolAttachment}` |
| GET | `/attachments/{id}` | — | `{data: {id, name, type, size, content: base64}}` (JSON, not a raw response) |

- `SchoolAttachment = {id, name, type, size, downloadPath}`. The decoded content is at most 1 MB; the client refuses larger files before any request, and the server must enforce the limit too.
- The metadata is saved with the record it belongs to:
  - `Assignment.attachments` on `POST /assignments`
  - `Submission.attachments` on `PATCH /submissions` `{assignmentId, studentId, text, attachments}`
  - `Thread.messages[].attachments` on `PATCH /threads/{id}`
- The backend must verify that each attachment id belongs to the same scope and owner as the record, and authorize downloads per scope.

Client behaviour:
- The file is read as its real bytes (`File.arrayBuffer`, or FileReader when that is unavailable) and base64-encoded.
- A failed upload keeps the chosen `File` and its encoded payload. **Retry upload** sends that identical payload once.
- Saving, turning in or sending is disabled while any file is uploading, failed or refused, until it succeeds or is removed.
- Drafts (title, answer, message text and uploaded files) are cleared only after the server accepts the record.
- Downloads decode the JSON content into a Blob of the stored type.
- All requests go through `host.request`; `host.fetch` is not used.

## Data ownership

Derived counters, ratings, covers, scores, grades, receipts, room activity and replies are always produced by the server. The client sends only what a user authored or chose, and renders the records the server returns.

The backend owns all production and demo data, including the seeded school, question bank, tariff, contacts, profile and any demo replies or room activity. This package ships **no** fixture data and exports **no** fixture subpath. Its only entry is `.`.

Fictional fixtures under `src/test-support/fixtures` exist solely for this package's unit tests, which run against an in-memory fake host (`src/test-support/fake-host.test-support.ts`). The public entry cannot reach them; `src/bundle-boundary.test.ts` checks the import graph and `package.json` exports.
