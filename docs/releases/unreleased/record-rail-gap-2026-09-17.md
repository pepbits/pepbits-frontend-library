# Record rail gap reduction — 17 September 2026

The shared record layout now groups desktop rail items with an 18px gap instead of distributing
spare height between them. This approximately halves the gap in the healthcare desktop reference
viewport. Button height remains 42px minimum, and mobile horizontal navigation keeps its 2px gap.
The start-aligned operational rail retains its existing 6px spacing.

Healthcare consumes the change through private package handoff `0.0.0-hc064.2`. Source identity is
base `ebddd6b7648935faa40a1a71c5b3339da70fe430` plus the reviewed patch recorded in healthcare's
`healthcare-frontend.lock.json`. The exact stylesheet hash is recorded below.

The healthcare production build/typecheck and 12-package integrity check passed. Browser verification
uses the existing synthetic fixture journey; no production patient data or live deployment is involved.
This CSS-only follow-up does not rerun the library's full unit/native matrix. Prior extraction evidence
remains historical. Documentation impact receipts were updated; inherited review backlog stays open.

No commit, push, registry publication or deployment performed for this follow-up.

Stylesheet SHA-256: `1914d470ea03f313a90118d56d3a90943d4c384f960de8e4231472bf423007ce`.
