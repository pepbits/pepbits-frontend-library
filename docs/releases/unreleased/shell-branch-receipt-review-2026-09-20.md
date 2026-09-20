# Fixed-branch documentation receipt review — 20 September 2026

This review resolves stale source receipts discovered by the QuantityUnitField documentation gate. No shell runtime code or historical release guide is changed. The existing [fixed-branch note](header-fixed-branch-2026-09-20.md) already describes the behavior added by commit `4d0f6d9f218d1c8528471c6d20fde5c376e91d3b`.

## Source comparison

The previous receipts exactly match the files in `4d0f6d9^`:

| Source | Prior receipt SHA-256 | Current HEAD SHA-256 |
| --- | --- | --- |
| `erp-shell/src/header.tsx` | `402843ed316d5223733ab409ff74e548fe968aaf83fff5ecbc23055e763cf766` | `dbf8e35da8f3cb82810f3825bf6c27527cb488dc6136a840b982df7a84c1f495` |
| `erp-shell/src/shell-host.tsx` | `c56b3b1eee98fc43e237fce42c84c75a34cccf51e2d122368b5c05944595887e` | `ec41995edb8f74ccfdbc3c90f429b55bef6780cd6a25195b47ae832b210957b6` |

Reading the commit diff and current files confirms two changes: the optional `ShellHost.branchReadOnly` property and its conditional rendering in Header. When true, the header shows the matching branch label as a status text with a title, or a neutral dash if no choice matches; it renders no branch selector. When false or omitted, the prior selector remains. The flag does not select a branch, change session state, determine list completeness or authorize an operation. Hosts still own those decisions and must supply authorized choices.

## Documentation impact

The shared host integration contract changed and was already documented in the dated fixed-branch note. Registered standalone demo page flows remain unchanged because the flag is optional and their default remains the selector. The two source receipts are refreshed as `no-content-impact` for those registered page guides, with a specific reference to the reviewed change and existing host documentation. This classification does not claim that the runtime change had no effect for opting-in hosts.

No canonical language messages, translated guide content, translation hashes, native-language review status or historical release snapshots are changed. The existing authoring/native-review backlog remains pending. The original fixed-branch note's historical validation statement is retained; this review records that the current source-receipt gate had drifted and has now been reconciled.

## Verification boundary

Only documentation checks are rerun for this receipt repair. The unchanged runtime was already included in the QuantityUnitField full test/build results. This review does not add browser, screen-reader, live host or authorization acceptance claims. See [QuantityUnitField verification](quantity-unit-field-2026-09-20.md) for retained gate evidence.
