# Settle source mapping

Phase 6e-4, base `5bbb130` on `main`. `source/settle` is a read-only reference and its backend runs unchanged. [App guide](README.md), [feature contract](../../docs/features/settle-demo.md) and [delivery record](../../docs/releases/unreleased/restructure-phase-6e-4-2026-10-24.md) state verification and deferrals.

| Original responsibility | Destination and treatment |
| --- | --- |
| `backend/` Express + SQLite API, rules, seed | Unchanged; run per its README on a free port. Base URL is configuration (`NEXT_PUBLIC_SETTLE_API_URL`, optional `/settle-api` proxy to `SETTLE_API_URL`) |
| `frontend/lib/api.ts` (`/api` fetch, `x-user-id`, error envelope, global revalidation) | `src/adapters/settle.ts` configured transport with path validation; `src/modules/settle/lib/api.tsx` public `ResourceScope`/`useFetch` with Settle mutation/revalidation orchestration per host user and desk user; obsolete reads and editors are cleared across identity changes |
| `frontend/lib/session.tsx` (`/meta`, rights, user switch, counter) | `lib/session.tsx`; desk user kept in `runtime.tsx` (tab-scoped, per host user). Host sign-in/session from public `ApplicationProviders` |
| `frontend/lib/format.ts` (`en-IN`, `₹`) | `lib/format.ts` `useFormat()` over the host formatter (currency, locale, decimals, date/time formats); labels and machine-date helpers retained |
| `frontend/lib/hotkeys.ts` | `lib/hotkeys.ts`; listeners exist only while `keyboardShortcuts` is on; ⌘K/`?` left to the shell |
| `frontend/lib/types.ts` | `lib/types.ts`, verbatim |
| `components/ui/primitives.tsx` | `components/ui/primitives.tsx`: same API over public `Source*` controls (translated names/placeholders), field-label association, preference-aware `Kbd`/`Skeleton`, `SettleTable` over public Table with managed table presentation and public TableRow keyboard activation |
| `components/ui/overlay.tsx` (dialog, drawer, menu, toasts) | Dialog/Drawer frames over public `SourceDialog` (focus, Escape, Tab containment) portalled into a themed `.settle-app` surface; menu with arrow keys; toasts through `ScreenHost.notify` (shell toasts) |
| `components/shell/AppShell.tsx`, `Sidebar.tsx` | Public `EnterpriseShell` sidebar/header/footer; Settle desk bar (counter, desk user, search, New bill, live waiting-work badges) and status footer in `AppShell.tsx`; brand mark in `Mark.tsx` |
| `components/shell/CommandPalette.tsx`, `NewBillDialog.tsx` | Ported; palette uses `SourceDialog` and combobox/listbox semantics; opened with `/` or the desk bar |
| `components/bill/*` (balance line, lifecycle rail, charges, quick add, bulk discount, charge drawer, sponsor split, payments, approvals, history, money rail, card terminal, deposits/points, reason dialog, bill settings) | `components/bill/*`, same workflows; quick add is an accessible combobox; host formatters; receipt print link replaces the toast action |
| `components/PrintSheet.tsx` (`rupeesInWords`) | Ported; print uses public `PrintDocument`; amount in words uses new public `indianNumberWords` (INR) or `englishNumberWords` + currency code |
| `app/(app)/*` pages and `app/print/*` | `pages/*.tsx`, one page-engine page each (`src/navigation.ts`, `src/renderer.tsx`, `modules/settle/page.tsx`) |
| `downloadCsv` | `lib/export.ts` over public `downloadGrid` in the effective export format (CSV/XLSX), formula-safe |
| `globals.css`, `tailwind.config.ts` (Onest font, fixed palette) | `src/app/globals.css` maps the palette names onto semantic theme tokens; `modules/settle/settle.css` scopes the source component classes; host font family, scales and radius apply |

Library additions: seven primitive icon re-exports (`ChartColumnBig`, `CircleDashed`, `Gift`, `Nfc`, `Tag`, `User`, `Vault`) and `indianNumberWords` in `@pepbits/i18n`. No other demo is imported; nothing generic was left in the module that another demo already needs.

The source frontend has **no test files**, so there is no original case to retain. New tests cover the transport, navigation, provider chain, every route under four preference profiles with axe, and the main workflows of each page group with a mocked Settle API built from frozen fixtures captured from the unchanged backend (`scripts/write-fixtures.mjs`). The real-HTTP script drives the same workflows against both unchanged APIs.

Deliberate presentation differences and deferrals are listed in the [app guide](README.md#completion-boundary).
