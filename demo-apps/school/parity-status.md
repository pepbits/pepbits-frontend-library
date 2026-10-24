# Scholaris visual parity handoff — phase 6d-2

This increment keeps the existing app and closes a coherent **chart and table presentation subset**. It does not claim exact parity for every route/state. [Source map](source-mapping.md), [feature guide](../../docs/features/school-demo.md), [release record](../../docs/releases/unreleased/restructure-phase-6d-2-2026-10-24.md).

The read-only baseline is `desktop-clients/packages/reference-school` at base `632ba8bf96ca4a9a9e9dd705aa7cdea5b3ed090a`. The test-only comparison bundles that original markup/CSS with its original UI packages and the current demo; both receive identical fictional in-memory fixtures, a frozen clock and a 1280px content area. The retained computed-style report pairs semantic controls/headings/table cells, recording geometry, typography, colours, radius and padding. Unpaired elements and unvisited states remain gaps. This is separate from the real-HTTP production-build integration; neither check is a deployed or native executable test.

## Measured landing-content evidence

The [final source report](../../docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/visual-comparison.json) and [summary](../../docs/releases/unreleased/evidence/restructure-phase-6d-2-2026-10-24/visual-summary.json) cover **124 paired cases / 248 renders**: 26 administrator routes plus five additional role dashboards, under four profiles. There were zero page errors and the browser closed. The measurement samples semantic headings/controls/tables and the first 20 table cells; geometric matches allow 0.5 CSS px, while sampled computed-style strings must agree. Hidden native inspection controls can appear in the element inventory. These counts are diagnostics, not whole-page acceptance.

| Profile | Matched sampled elements | Different sampled elements | Unpaired source elements | Additional demo elements |
| --- | ---: | ---: | ---: | ---: |
| Default | 1,246 | 67 | 54 | 171 |
| Arabic RTL | 1,138 | 175 | 54 | 171 |
| Result font 16 | 1,177 | 136 | 54 | 171 |
| Reduced motion | 1,246 | 67 | 54 | 171 |

Default/reduced-motion differences among paired elements are Admissions (60) and Calendar (7). All six measured line-chart cases, five ring/donut cases and six bar-chart cases have identical default/reduced-motion geometry and sampled mark colours. The 12px report-section displacement found in the initial sweep was corrected by restoring horizontal-row line height. Four retained dashboard/student captures were inspected; neutral avatars remain visibly different.

Arabic line coordinates intentionally mirror the six source plots. Logical table alignment/toolbar positioning and the named Actions header produce the remaining RTL table differences. At independent result scale, Attendance's plot width is 389px versus source 306px; Student/Parent dashboard plots are 389px versus 371.5px, while their authored heights remain unchanged. Labels and neighbouring content follow the effective result font, producing reflow and vertical offsets. The source follows base scale in those locations. Rings/donuts and bars retain matching sampled geometry in all four profiles.

Unpaired default source elements are the blank action headers/table text on Fees and Librarian dashboards (two each), Calendar navigation/date controls (44), and Accountant class cells/table text (six; API-imposed). The report retains every key and actual property difference. Every route still has the state-specific follow-up below.

## Delivered adapter corrections

- Line plots preserve source heights, explicit bounds, area fill and series colour. A focus-revealed native selector retains keyboard value inspection without a permanently visible form enlarging the card. HTML labels and SVG geometry follow the source arrangement. Result font scale and RTL logical offsets remain effective preferences. RTL plots mirror their point coordinates to match the right-to-left labels; the original source keeps physical left-axis coordinates, so that source difference is intentional.
- Bar adapters restore the source 10% automatic scale headroom, grid/track tint and 16px horizontal-row line height (scaled with the effective result font); explicit maxima remain unchanged.
- Donuts preserve source diameter, stroke, segment colours, centre text and caption. Named legend buttons retain keyboard inspection and effective formatting. Existing standard shared-chart consumers keep their defaults.
- Calendar days restore the source `+N more` indicator and full event titles when more than three events fall on one date; selecting the day reveals the complete agenda.
- Collection tables preserve source header metadata, result font size, header/button typography, separators, row hover/selection and visible sort direction. Density, wrapping, striping, sticky headers and page size remain managed by the shared presentation host.

Library additions are optional compact presentation props on `LineChart`/`DonutChart`, `ChartSeries.fill` and `CollectionColumn.headerClassName` in `@pepbits/components`. No dependencies, new exports or API changes. Tests and the package README describe the contracts. The source chart-localization test retains its assertions with a tooltip punctuation adaptation.

## Per-route remaining work

Every row is a **remaining** status until its full states have an exact source comparison. Default landing-content measurements are evidence for a subset, not a pixel-match label. RTL table headers and toolbar actions use logical start/end alignment rather than the source’s physical left/right placement; RTL compact lines mirror points and area fills to stay aligned with their labels. Independent result font changes can resize chart labels and surrounding rows where source markup followed the base scale. These are intentional preference corrections. Source contrast corrections from phase 6d are retained: neutral avatar fills/foregrounds; readable subject-code/timetable text; darker calendar category fills; steady live-status text. Those intentional differences are named below rather than reverted.

| Route | Changed / retained composition | Exact remaining difference or unverified state |
| --- | --- | --- |
| `/dashboard` | All six role layouts; source line/donut options restored | Shared bar/ring inspection treatment and result-scale typography; full shell offsets; see role rows below. |
| `/reports` | Four report tabs; restored 220px attendance plot and 150px enrolment/finance donuts | Shared bar inspection treatment and independent result typography; source print output and every report-tab screenshot remain unverified. Accountant class lookup/filtering remains API-imposed. |
| `/students` | Source collection typography, header metadata, separators and sorting | Neutral avatar fill/foreground differs from source name-seeded colour. Opened record tabs, all preview frames and source print geometry require paired captures. |
| `/students/new` | Original four-step form and controls | Source screenshots of steps 2–4, validation and completion remain unverified; no durable draft recovery. |
| `/teachers` | Source collection presentation | Neutral avatars and readable subject-code/mini-timetable foreground differ; drawer tabs and all preview frames remain unverified. |
| `/teachers/new` | Original registration form and controls | Subsequent form steps, validation and completion screenshots remain unverified; no durable draft recovery. |
| `/admissions` | Existing shared board and acknowledged moves | Source 210px columns/8px gap, tinted stage headers/hints and compact card/score/hover-arrow arrangement differ from shared 250px columns/12px gap and persistent move selector. Application/detail dialogs need paired comparison. |
| `/classes` | Source class cards and detail content | Named title buttons replace whole-card keyboard buttons for accessibility. Neutral avatars, opened roster/subjects/preview frames remain unverified. |
| `/subjects` | Source collection presentation | Readable subject-code foreground differs from source category colour. Create/edit dialog screenshots remain unverified. |
| `/timetable` | Original timetable composition and filtering | Subject names use readable text instead of category-coloured text. Every class/teacher view, current-period state and print output remain unverified. |
| `/attendance` | Original register and calendar composition | At result font 16 the plot is 389px wide versus source 306px because surrounding content follows result scale. Register status interactions, summary/month states and source print geometry require paired screenshots; saved HTTP register remains covered separately. |
| `/assignments` | Original assignment cards, submission and grading | Neutral avatars; opened assignment/submission/grading dialogs and attachment/error states remain unverified visually. |
| `/quizzes` | Original quiz cards/filters | Subject-code foreground uses readable text rather than category colour; all role/filter states remain unverified visually. |
| `/quizzes/new` | Original builder and answer-option controls | Untitled-question foreground is readable rather than faint. Alternate question types, validation and publishing dialogs require paired captures. |
| `/quizzes/:id` | Original start/player/result composition | Active answer tiles, timer, submit dialog and graded review require source screenshot comparison; real-HTTP preview/grading remains independently covered. |
| `/exams` | Source table presentation and exam composition | Create/schedule/detail dialogs and their print views remain unverified visually. |
| `/marks` | Original specialized mark-entry cells | Exam/class/subject states, edited values, result-card preview and source print geometry remain unverified visually. |
| `/live` | Original session cards and filters | Live-status badge intentionally stays opaque instead of pulsing. Create/schedule/detail states remain unverified visually. |
| `/live/:id` | Original room/media/whiteboard composition | Neutral avatars; joined room, poll/participants/chat/reactions and media states need source comparison. No transmitted conferencing media is implemented. |
| `/whiteboard` | Original canvas, tools and authored drawing coordinates | Draw/erase/undo/background/zoom states and exports need paired visual comparison; no exhaustive canvas acceptance. |
| `/library` | Source collection presentation and circulation commands | Catalogue/circulation dialogs and printed issue/fine records need paired captures. Librarian new-borrower restriction remains API-imposed. |
| `/fees` | Source collection presentation and authoritative receipts | The named Actions header replaces a blank source header. Collection/receipt/detail dialogs and source print geometry remain unverified. Accountant class labels/filtering remain API-imposed. |
| `/calendar` | Shared Gregorian calendar, agenda, event creation | Month controls sit in the date-picker header, weekday labels are narrow, day buttons have selected fills and managed table padding; source has a border-separated six-week event grid. Three category colours remain darkened for contrast. Overflow counts are restored; dialogs and print need follow-up. |
| `/notices` | Original notice cards/filters | Composer/edit/detail states and every priority/role filter need paired comparison. Restricted role access remains API-imposed. |
| `/messages` | Original conversation composition | Neutral avatars; selected thread, attachment/error and new-conversation states need paired source comparison. |
| `/settings` | Original profile/notification/security composition | Notification/security panels, validation and session/confirmation dialogs need paired comparison. Preferences delegates to the shared host, rather than a second preference store. |

## Six role dashboards

| Role | Delivered subset | Remaining |
| --- | --- | --- |
| Administrator | 150px attendance plot, 85–100 bounds; 84px donut with 11px stroke/source palette; original KPI/cards | Shared bar inspection treatment and independent result typography; all shell, theme and live-data combinations unverified. |
| Teacher | Source line geometry and managed collection typography | Neutral avatars; ring/bar inspection treatment, schedule/detail states and full-shell comparison. |
| Student | Source line geometry and managed collection typography | Neutral avatars; progress-ring/bar inspection treatment. At result font 16, plot width is 389px versus source 371.5px. Alternate student states and full-shell comparison remain. |
| Parent | Same student layout scoped to the selected child | Same avatar/ring/bar differences and 389px versus 371.5px result-scaled plot width; all child-selection states and full-shell comparison. |
| Librarian | 150px circulation plot, explicit zero floor and unfilled returned series; overdue table typography | Named Actions header replaces the source blank header and changes RTL column widths; independent result typography. Restricted academic collections remain denied. All full-shell/data combinations unverified. |
| Accountant | Source donut/line options and collection presentation wherever present | Shared bar inspection treatment and independent result typography; class labels/filtering and academic collections remain API-imposed. Full-shell/data combinations unverified. |

## API-imposed and acceptance boundaries

The unchanged API denies Librarian Students/Calendar/Notices and Accountant Students/Notices. Librarian issue creation can select only borrowers already in permitted circulation records; unrestricted new-borrower lookup remains unavailable. Accountant class labels and class filtering remain unavailable. Durable drafts remain deferred; mounted retry/input retention is not durable recovery. No alternate persistence store or invented backend contract is introduced.

The protected Library `student-master`/`school-fees` templates are separate from these 26 Scholaris pages and remain outside this increment. Physical printing, native executables, production identity/providers, native-speaker review and human accessibility/academic/accounting acceptance remain unperformed. No commit or push.
