# Fixed branch presentation — 20 September 2026

`ShellHost.branchReadOnly` lets an application render its active branch as text in the shared
header, without a dropdown or change action. The name comes from the host's branch list. Missing
selection renders a neutral dash. Hosts remain responsible for context loading, access validation,
first/default selection and determining whether the list is complete. Existing consumers retain
the selector by default. This flag is presentation, not an authorisation control.

Healthcare uses the capability for a complete single-branch list and for an empty list. It keeps
registration unavailable without authorised context. Its reviewed pinned-source distribution
contains the equivalent change; other application bundles are not automatically upgraded.

All workspace type checks passed. The focused shell chrome/context suite passed 61 tests.
Documentation validation passed. Healthcare consumer browser verification is recorded separately
in its HC-088 task. No standalone library deployment or live authenticated acceptance claimed.
