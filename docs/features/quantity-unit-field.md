# Feature: Quantity and unit field

Feature ID: QTY-01. State: implemented; local verification is recorded in the [delivery note](../releases/unreleased/quantity-unit-field-2026-09-20.md). No application has adopted this export in this increment.

## User problem and outcome

A quantity and its unit must remain together while the user edits them. Applications can now compose the shared `Input` and `Select` through `QuantityUnitField`, receiving one controlled string pair. The component displays an exact conversion preview supplied by its host; it never calculates or rounds a quantity.

## User and administrator flows

1. The host supplies an accessible group label, quantity label, unit label and authorised unit choices.
2. The user enters quantity text and chooses a unit. Each callback contains both values. Changing a unit retains the entered quantity; any conversion or deliberate reset is a host decision.
3. The host validates the input and obtains its exact preview. Supply the original input pair as `preview.forValue` and a localized display as `preview.content`.
4. A preview for a different quantity or unit is hidden. Loading and validation errors also hide the preview.
5. Disabled, read-only and loading states guard callbacks. The host resolves managed policy before passing those states; presentation locks do not authorize a business action.
6. Field errors are associated with the applicable input. A group error is associated with both controls and announced as an alert. Correcting the error does not discard controlled values.

An empty choices list has no generated unit or fallback. The host must provide loading/error guidance and prevent submission until its required choices are available. For an existing inactive unit, preserve a labelled historical choice in read-only presentation or require explicit replacement; do not silently choose a different unit. Use a nonempty stable code for a valid base-unit choice when native `required` applies; mapping that code to an API's null pack ID belongs to the host.

## Technical contract and integration

Public exports from `@pepbits/ops-ui` are `QuantityUnitField`, `QuantityUnitFieldProps`, `QuantityUnitValue` and `QuantityUnitPreview`.

```tsx
import { QuantityUnitField, type QuantityUnitValue } from '@pepbits/ops-ui';

// The application owns value, loading, errors, choices and its exact preview.
function AmountEditor({ value, onChange, options, preview, busy, error }) {
  return <QuantityUnitField
    label="Requested supply" quantityLabel="Quantity" unitLabel="Unit"
    value={value} onChange={onChange} options={options}
    loading={busy} loadingLabel="Checking configured units"
    error={error} preview={preview} required
  />;
}
// onChange accepts QuantityUnitValue: { quantity: string; unit: string }.
// Example preview supplied by a host:
// { forValue: { quantity: '2', unit: 'box-100' }, content: '2 boxes = 200 each' }
```

The example preview is explanatory text, not a conversion implementation. Callers should use their canonical localization messages for the supplied labels. The component adds no tenant/API/authentication dependency, network request, persistence, arithmetic or domain validation. It preserves text such as `0.`, leading zeros and long decimals; a host may reject these before any command.

`forValue` prevents displaying an older result for a different controlled pair. The host must also clear or replace previews when the item, tenant, branch, policy, unit catalogue or conversion revision changes, even if the pair stays identical. The host fences asynchronous responses and enforces revision/idempotency rules at the server. This component alone cannot certify that a preview is current or authoritative.

`quantityName` and `unitName` support normal form integration. `quantityHint`, `unitHint`, `quantityError`, `unitError` and the group `error` carry host guidance. `quantityPlaceholder` and `unitPlaceholder` are optional. Quantity is a text input with decimal input mode, avoiding browser number coercion. Inputs remain controlled; there is no hidden draft store.

## Compatibility, localization and accessibility

This is an additive export. Existing controls and consumers retain their previous behavior; no business route, schema or package version changes. The existing component-catalog TextDemo includes a runnable example using EA/BOX code choices; those sample choices are not tenant master data. It uses the existing control theme/font/radius tokens and responsive layout. Effective preferences continue to be supplied by the host; there is no local preference override. Native controls preserve keyboard operation. No animation or custom keyboard listeners are added.

Labels and messages are host-supplied and pass through the existing localization provider. Preview content is already localized by the host. No new default English copy or localization catalogue entries are introduced. Tests exercise supplied Arabic labels and stable unit identifiers; that is not native-speaker review or full browser accessibility certification.

## Acceptance, completed and pending work

QTY-01 component tests cover labels and descriptions, raw decimal text, atomic unit changes, controlled rerendering, stale-pair preview suppression, disabled/read-only/loading guards, associated validation and RTL supplied copy. See the [delivery evidence](../releases/unreleased/quantity-unit-field-2026-09-20.md) for actual commands and results.

Pending: catalogue-backed packaging adapters and exact preview APIs, consumer adoption, real browser visual/keyboard and screen-reader acceptance, localization review, approved archive packaging and publication. Healthcare, ERP and School pins are unchanged.

## Operations and support

If a preview disappears, check its exact `forValue` pair, loading state and validation messages. If inputs are locked, inspect the effective host policy rather than creating local overrides. The host owns retry and draft recovery. Removing this unused export from a proposed release is a source rollback; no tenant migration or data cleanup is needed.
