# Healthcare Suite reference source

CarePoint is imported into the frontend library as a separate header module named **Healthcare Suite**, with module ID `reference-healthcare-suite`. It keeps a distinct module identity from the existing **Healthcare** module.

The imported UI follows the original CarePoint screens and interactions. Data operations cross the API boundary; demo rows and business operations belong to the source-backed JavaScript API adapter seeded from the original CSV fixtures, not frontend mock stores. The host provides the existing demo authentication and its application shell/navigation. The original CarePoint source itself documents no authentication.

The [source inventory](SOURCE-INVENTORY.json) records SHA-256 for every original source input included in the source tree. The [PAGE-GUIDES.json](PAGE-GUIDES.json) file contains one source-reviewed English guide for each of the 23 imported static destinations; entries are authored drafts, not native-speaker approvals. The original tree remains unchanged. Dependencies, generated builds/caches and private environment files are excluded.

The source README documents simulated eligibility, prior approval and eRx behavior. These are demo API operations only: no real payer, electronic-prescribing or claims service is connected. This import does not claim production readiness or acceptance of every source business flow.
