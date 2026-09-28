# School browser evidence (2026-09-28)

Actual Playwright Chromium at 1440×1000, light appearance. Original School http://127.0.0.1:4034; candidate http://127.0.0.1:4322; candidate API http://127.0.0.1:4320. No route interception, synthetic browser responses, or API fixture replacement.

## Read comparisons

11 initial captures plus 2 source dynamic captures. Zero page JavaScript errors, zero console errors, zero API HTTP errors, zero horizontal module overflow.

Dashboard retains 6 KPIs and all 6 chart/list panels. Both use 13px content and 13px dashboard headings; host Inter replaces source GeistSans. Candidate content width 1340px vs original main 1384px; candidate host shell padding and shared rounded cards/controls are intentional adaptation. Both show 333 students, 34 staff, 12 overdue accounts, 38 loans and identical financial totals; preferences account for AED vs source dollar and 93% rounded vs 92.5%. Earlier candidate0live capture was superseded after final API restart; refreshed dashboard/live screenshots and real API both show7live sessions, matching source.

Students retain all 10 source columns. Shared default page size 20 vs original 15, comfortable shared rows approx60px vs source approx47px. Shared drawer panel620px vs source672px, same student Ava Sato, same profile fields, metrics, all4 tabs and actions. [role=dialog] is candidate overlay, not its panel; comparison screenshot includes overlay to show host integration.

Quiz introduction retains centered768px card, same History checkpoint, 4 questions,15min,4points, all instructions and buttons. Questions load from real server API. Date/currency/avatar/rounded controls use host preferences. Original live lobby shows actual unavailable-device notice in headless browser, source avatar88px, real mic/camera toggles, title/class/host and Join control.

Read results: read-results.json and source-dynamic-results.json; screenshots named original-* and candidate-*.

## Action checks

Completed against frozen API4320 and optimized frontend4322. Four of four genuine UI action checks pass; zero page errors, zero console errors, zero API HTTP errors across fresh action run and focused library retry. Structured final results: action-results-final.json; raw runs action-results.json and action-results-library-retry.json.

- Actual shared file picker uploaded75UTF-8 bytes, saved assignment draft as-mukxkhqp-drtv with attachment att-mukxkh6z-x1qvld, downloaded via UI, and exact-byte comparison passed.
- Canonical overdue loan is-2 for bk-7 (A Brief History of Time / Elena Vasquez) returned via UI; server fine1.5, available copies6→7, repeated return stays7, total copies8. First selector attempt targeted a row outside the first20; actual table search made it visible. No request occurred on the first failed selection.
- Staff preview used actual quiz qz-1 questions, selected one incorrect answer, flagged it, confirmed submit, received serverPOSTgrade200 with0/4, and rendered server Answer review. Preview is not recorded as a student attempt.
- Actual UI instant session li-mukxl313-v442 loaded lobby with real native media unavailable notice; mic/camera toggled off; server join, actual browser message persisted, seven server participants displayed; UI End persisted statusEnded. Participant/chat fixtures come from server, not browser response interception.

Dashboard and live screenshots refreshed after final restart show7live. Candidate lobby retains source max1024px frame,610px media area,88px avatar and right-hand details/actions; host uses shared controls and formatting. Candidate live room fits all gallery, chat and source toolbar controls within host content.

Restart invalidated the initial saved authentication token (startup401 before any mutation); fresh real UI login was used for the final checks. No frontend/backend files changed. Camera/microphone absent in headless browser; no media relay or video recording byte verification performed.
