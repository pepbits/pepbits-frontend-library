/** Source Quality navigation, preserved as one independent module. */
export const QUALITY_REFERENCE = {
  "id": "reference-quality",
  "variant": "quality",
  "title": "AllyVora Quality",
  "shortLabel": "Quality",
  "accent": "#0e6b5c",
  "pages": [
    {
      "id": "reference-quality-dashboard",
      "path": "/",
      "title": "Dashboard",
      "section": "overview"
    },
    {
      "id": "reference-quality-indicators",
      "path": "/indicators",
      "title": "Indicators",
      "section": "performance"
    },
    {
      "id": "reference-quality-tat",
      "path": "/tat",
      "title": "Turnaround times",
      "section": "performance"
    },
    {
      "id": "reference-quality-events",
      "path": "/events",
      "title": "Event Pulse",
      "section": "performance"
    },
    {
      "id": "reference-quality-verification",
      "path": "/verification",
      "title": "Verification",
      "section": "assurance"
    },
    {
      "id": "reference-quality-validation",
      "path": "/validation",
      "title": "Validation",
      "section": "assurance"
    },
    {
      "id": "reference-quality-reports",
      "path": "/reports",
      "title": "Reports",
      "section": "reporting"
    },
    {
      "id": "reference-quality-schedules",
      "path": "/schedules",
      "title": "Schedules",
      "section": "reporting"
    },
    {
      "id": "reference-quality-submissions",
      "path": "/submissions",
      "title": "Submissions",
      "section": "reporting"
    },
    {
      "id": "reference-quality-authorities",
      "path": "/authorities",
      "title": "Authorities",
      "section": "administration"
    },
    {
      "id": "reference-quality-users",
      "path": "/users",
      "title": "Users and roles",
      "section": "administration"
    },
    {
      "id": "reference-quality-audit",
      "path": "/audit",
      "title": "Audit trail",
      "section": "administration"
    },
    {
      "id": "reference-quality-indicator-detail",
      "path": "/indicators/[id]",
      "title": "Indicator detail",
      "section": "performance"
    },
    {
      "id": "reference-quality-report-designer",
      "path": "/reports/designer",
      "title": "Report designer",
      "section": "reporting",
      "navigation": false
    },
    {
      "id": "reference-quality-report-detail",
      "path": "/reports/[id]",
      "title": "Report detail",
      "section": "reporting"
    }
  ]
} as const;
