# External healthcare host composition — 17 September 2026

Base: `2f8c5b42bd33c609d344c9ea410c2d29503ce40e` plus the working changes recorded by
Healthcare Enterprise's `healthcare-frontend.lock.json`. Distribution `0.0.0-hc060.2` is an unpublished
private archive handoff, not a Git tag or public npm release.

- Added host-owned session injection and optional enterprise-shell header/footer slots.
- Added public narrow DCP fields and template entry points.
- Added an authorized field-renderer hook for domain reference selectors.
- Prevented removal of the final required collection row.
- Removed the Preferences shortcut from products that do not provide that page.
- Kept default session, header and existing product behavior when no host adaptation is provided.

The [feature contract](../../features/hosted-healthcare-composition.md) defines responsibilities,
permission boundaries and recovery. Existing registered library pages do not opt into the new host
callbacks. The last-row control enforces the existing required-collection rule earlier in the UI.
Existing guidance to complete required collections remains valid.

Verification: 74 component tests passed across runtime fields, host runtime, session and ERP context;
the consuming application runs its own BFF/API, isolated PostgreSQL and synthetic browser checks.
Documentation validation and final source manifest are recorded at handoff. No native desktop,
library demo deployment, native-language review or npm registry publication is claimed.
