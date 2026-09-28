# School role views in the module header

Feature ID: SCHOOL-ROLE-VIEWS. State: implementation in progress; runtime acceptance and deployment pending. Affected application/pages: School reference module in the shared header. Related release: [School role views — 28 September 2026](../releases/unreleased/school-role-header-2026-09-28.md).

## Choose a School view

1. Sign in to the synthetic demo site and open the module selector in the application header.
2. Choose the School view for your work: Administrator, Teacher, Student, Parent, Librarian or Accountant. Your page navigation and landing dashboard follow that view.
3. Open pages from its navigation. The School views reuse the same 24 page registrations and routes; selecting another view does not create a second copy of the School pages.
4. If a route is outside your view, return to its dashboard and use a page listed in your navigation. A direct URL or edited request does not grant access.

The synthetic `enterprise-admin` demo identity is explicitly entitled to all six views for demonstration. A School-role account receives only its own role view. Selecting a view changes the effective School persona used for the request while the authenticated account identity is carried into the API handler. The API checks the requested `X-Reference-Module` against that account on each School request. Header choices are not authorization.

## View contents

| View | Typical navigation |
| --- | --- |
| Administrator | School overview and reports; people and admissions; academics; learning; operations |
| Teacher | Today, teaching, assessment and school resources |
| Student | Today, learning, progress and school information |
| Parent | Child overview, attendance, results, timetable, fees and messages |
| Librarian | Dashboard, catalogue and circulation, students and library notices |
| Accountant | Finance dashboard, fees, students, reports and notices |

The exact page list is provided by the School navigation for each view. Shared settings and dashboard routes remain part of the School module. The Reports, ERP1 and ERP2 header choices retain their existing module identities and behavior.

## Demo and integration boundary

This is a fictional reference module. Demo credentials and records are synthetic; this guide does not describe a production school identity or authorization service. A consuming application must authenticate its users and enforce role, tenant, branch, page and operation permissions on its server. It must not treat a client-selected module or role as proof of permission.

The School frontend sends its selected module identity as `X-Reference-Module`. The demo API validates that identity against the authenticated account and applies the corresponding persona while retaining the original actor. It denies unavailable School modules and pages. Production hosts should preserve these server-side checks and provide their own identity, data and business services.

## Compatibility and current acceptance

Role views are header-level module entries backed by the existing School page catalogue. There is no duplicate 24-page registry for each role. Reports, ERP1 and ERP2 retain their legacy header behavior. Existing School route and workflow behavior remains in the same reference module.

Runtime, browser, build, localization and deployment results for this change are pending. See the [unreleased change record](../releases/unreleased/school-role-header-2026-09-28.md) for the gate status. This guide does not claim native-speaker review, production authorization acceptance or deployment.
