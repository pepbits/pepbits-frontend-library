---
"@pepbits/healthcare": minor
---

Add the consultation workspace and reusable note, findings, history, score, care and order workflows through typed data ports and host navigation/slots. Carry forward confirmed-diagnosis score autofill with encounter context, support entered-in-error procedure-history corrections, and expose procedure completion metadata on consultation orders.

Hosts supply HTTP/session services, MAR, returns, vaccines, pharmacy proposal editing, telehealth and printing. Update score-autofill adapters to `(patientId, encounterId?, signal?)`. New-copy translations and live API acceptance remain pending. Public imports use `@pepbits/healthcare/clinical` and `@pepbits/healthcare/clinical/model` following the package rename from `@pepbits/clinical`.
