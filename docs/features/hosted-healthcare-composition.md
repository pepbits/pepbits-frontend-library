# Hosted application composition

17 September 2026. Generic library capabilities consumed by Healthcare Enterprise HC-060.
The library contains no patient API paths, clinical grants, tenant IDs or production patient data.

## User flow

The application obtains its verified session from its own backend, mounts the shared enterprise
shell and supplies its permitted pages. A user searches for a record and opens the application-owned
record tab. The server supplies DCP field metadata; the library renders the permitted controls.
An optional reference selector comes from the host, without replacing the generic form renderer.

## Public contract

```tsx
import {HostSessionProvider} from '@pepbits/auth';
import {EnterpriseShell} from '@pepbits/erp-shell';
import {DcpRuntimeFields} from '@pepbits/erp-screens/dcp-fields';

// Mount inside ProductProvider, NavigationProvider and ERPProvider.
<HostSessionProvider value={verifiedHostSession}>
  <EnterpriseShell header={applicationHeader} footer={applicationFooter}>
    <DcpRuntimeFields
      fields={view.sections.flatMap(section => section.fields)}
      values={values}
      view={view}
      disabled={saving || !canEdit}
      change={change}
      renderField={renderAuthorizedReference}
    />
  </EnterpriseShell>
</HostSessionProvider>
```

`HostSessionProvider` injects a `SessionValue`; it performs no demo authentication, token persistence
or session validation. The host must obtain and expire that value through its trusted session API.
Custom shell slots are optional; existing applications keep their current header/footer by default.
The sidebar exposes Preferences only when the product registers that page.

`renderField` receives `{field, path, value, disabled, error, change}`. Return `undefined` to use
the default control. It is not invoked for masked fields or fields without write permission. For a
globally disabled form, it receives `disabled: true` and its change callback is guarded. The host
must use shared controls and respect the supplied disabled state. Nested existing rows still require
the server's per-row authorization metadata. A required collection cannot remove its final active row.

## Preferences, permissions and recovery

Effective shell preferences, localization, semantic tokens and managed controls remain inherited.
The hook does not evaluate conditional expressions or determine authorization. The application
provides server preview, current configuration checksum, record version, idempotent save identity,
request cancellation and appropriate error recovery. Hidden/masked values must not be reconstructed
from separate caches. Draft persistence remains a host decision; this API does not make sensitive
values safe to place in browser storage.

## Verification and delivery boundary

Component tests cover host sessions without demo traffic, protected custom controls, nested row
identity, missing row permissions, required collections and the existing runtime/preference behavior.
Healthcare Enterprise separately tests its BFF, PostgreSQL adapter and production browser build.
Private archives use source commit plus reviewed patch provenance. These changes are not a registry
publication, deployment of the library demo sites, or certification of a complete clinical application.
See the [delivery record](../releases/unreleased/host-composition-2026-09-17.md).
