# Reusable record pages

The shared record presentation extracted from the healthcare registration host is available to other
SaaS applications. It composes the existing EnterpriseShell, RecordSectionLayout, RecordSectionCard,
DCP controls and semantic theme tokens. It does not introduce another patient renderer or data service.

## Public components

| Component | Package export | Responsibility |
| --- | --- | --- |
| WorkspacePage | `@pepbits/erp-shell` | Full-width workspace; opt-in record container and compact outer gutters |
| RecordPage | `@pepbits/erp-screens/record-page` | Numbered sections, identity rail, feedback and compact action footer |
| RecordIdentity | same | Record label, display name and reference |
| RecordNotice | same | Banner, message or muted explanation; optional status/alert role |
| RecordActionBar | same | Shared button sizing, alignment and host-supplied action visibility |
| DcpSectionFields | `@pepbits/erp-screens/dcp-fields` | Project authorized primary-row fields and related collections into a section |

RecordPage accepts typed section definitions, effective preferences, render callbacks, completion
indicators and actions. Section navigation keeps mounted inputs, so changing tabs/layout does not
unmount local drafts. Those values remain in memory; this is not durable draft storage.

WorkspacePage with `layout="record"` fills the EnterpriseShell content area. RecordPage uses
RecordSectionLayout's opt-in `sizing="container"`. Existing template consumers keep the default
viewport behavior. Compact gutters and footer spacing now live in library CSS modules, including
logical inline spacing for RTL. Consumers must not copy the healthcare CSS or use `!important`
overrides against the layout's descendants.

## Example: another application's customer record

Place this component inside the application's configured EnterpriseShell. Providers must resolve
its authenticated user, effective preferences and tenant locks as usual.

```tsx
import type { ReactNode } from 'react';
import { WorkspacePage, useERP } from '@pepbits/erp-shell';
import { RecordPage, RecordIdentity, type RecordPageSection } from '@pepbits/erp-screens/record-page';

type CustomerRecordProps = {
  sections: RecordPageSection[]; active: string; setActive: (id: string) => void;
  customer: {name: string; code: string}; save: () => void; canSave: boolean; busy: boolean;
  isComplete: (id: string) => boolean; renderSection: (section: RecordPageSection) => ReactNode;
};
export function CustomerRecord({ sections, active, setActive, customer, save, canSave,
  busy, isComplete, renderSection }: CustomerRecordProps) {
  const { preferences } = useERP();
  return <WorkspacePage layout="record">
    <RecordPage sections={sections} active={active} onActive={setActive}
      preferences={preferences} isDone={isComplete}
      identity={<RecordIdentity label="Customer" name={customer.name} reference={customer.code}/>}
      actions={[{id:'save', label:'Save customer', primary:true,
        hidden:!canSave, disabled:busy, onClick:save}]}
      renderSection={renderSection}/>
  </WorkspacePage>;
}
```

Type the adapter props using the consumer's own domain contracts and exported RecordPageSection /
RecordPageAction types. The example intentionally requires host handlers and data; it does not use
an implicit demo API. Labels supplied to shared controls pass through the library localization
provider; the host supplies localized rich content and business messages.

For DCP, pass the primary collection code and the field/collection codes belonging to each section.
The component intersects those requests with the server-provided view. Existing rows require their
specific `rowFields` entry; missing metadata never falls back to create permissions. Masked parent
collections never expose their row values. Hidden field values are not deleted by section rendering.
The existing DcpRuntimeFields renderer still owns field validation presentation, repeatable controls,
read-only values and masked controls. Hosts retain schema selection, section classification and save
patch construction; APIs remain responsible for authorization and validation.

## Preferences, security and performance

- Pass resolved `useERP().preferences`; do not pass default preferences in a hosted application.
- Theme, density, form navigation, card appearance, font scales and reduced motion continue through
  existing library components. No duplicate page-level Theme/Layout/Density controls are added.
- Action `hidden` and `disabled` flags are presentation. Server authorization remains mandatory.
- Components make no requests, run no polling and write no browser storage. API bounds, retries,
  idempotency, conflict handling and tenant isolation stay with the host.
- The healthcare adapter retains patient identity, MRN, section classification, consent, history,
  review and duplicate checks. Those are domain responsibilities, not generic style APIs.

## Validation and adoption

Component tests include a non-healthcare customer record, retained drafts, preference changes,
hidden/disabled actions, and DCP row authorization. Healthcare browser fixtures cover the actual
packaged consumer, New/Edit/View, consent, failure recovery, policies and responsive layout.
See [delivery evidence](../releases/unreleased/record-components-2026-09-17.md).

Other apps opt in by adopting a reviewed package release containing these exports and composing
WorkspacePage/RecordPage. Existing apps are not silently upgraded. No live deployment or registry
publication is implied by the local package handoff.
