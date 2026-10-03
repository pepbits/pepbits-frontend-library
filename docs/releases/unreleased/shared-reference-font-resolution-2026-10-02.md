# Shared reference-font resolution — 2 October 2026

Status: application defect corrected; **normal-terminal Next build passed (user-reported)**. Runtime/browser acceptance and public deployment remain pending.

## Problem and correction

A normal SSH-terminal Next 16.3.3 Webpack build confirmed five unresolved Public Sans/Bricolage Grotesque font files. The existing shared stylesheet used bare `@pepbits/tokens/fonts/...` URLs. After CSS imports, Next's CSS loader interpreted these as relative requests such as `./@pepbits/tokens/fonts/...` under the host app. Font files existed, but these requests pointed at nonexistent locations. This is an application build defect, separate from agent-session socket/network/child-process restrictions.

`packages/tokens/src/reference-fonts.css` now uses `./fonts/...` URLs relative to the shared stylesheet. Tailwind rebases imported font assets against each host. Existing family names, weights, styles, unicode ranges, font binaries and license/provenance remain unchanged. MedBand and RCM parity builders consume this shared stylesheet directly rather than rewriting package URLs. Both web and desktop hosts retain their shared import and source styling.

## Validation

The [validation receipt](evidence/shared-reference-font-resolution-2026-10-02/validation.json) retains the source identity and command scopes. The new `npm run test:reference-fonts` tests process each actual host stylesheet with Tailwind/PostCSS and compile it using Next's real Webpack CSS loader. Both tests reproduced the missing-font requests before the correction and pass afterward. All five expected emitted font files match the original binary hashes in each host build. The Vite production browser build also passes; this does not establish native executable or browser visual acceptance.

This regression test supplies Next's required tracing/PostCSS context to the actual CSS loader; it does not bypass or disable TypeScript in a Next application build. It is deliberately a CSS/asset compilation test, not a replacement for `next build`. Shared token styles are now included in documentation-impact tracking; this asset-resolution correction changes no page workflow or translated content.

## Verify and complete

From `/home/pepadmin/pb/saas/lib/pepbits-frontend-library/desktop-clients`, run `npm run test:reference-fonts`, then the unchanged normal-terminal Next build command. Use [the exact terminal procedure](../../../desktop-clients/docs/surgisuite-terminal-validation.md) to build matching API URLs, start isolated synthetic services and run authenticated SurgiSuite browser acceptance. Any additional application failure must be reviewed from that terminal's actual output.

No server DNS, live data or deployment services were changed. Previous verification records retain their own source identities. No successful complete Next build, public deployment, native/domain review or real-care/provider integration is claimed by this correction.

## Subsequent normal-terminal build

The user supplied successful Next 16.3.3 Webpack output after this correction: compilation, TypeScript, page-data collection, three static pages, traces and optimization completed. The [separate terminal report](evidence/shared-reference-font-resolution-2026-10-02/normal-terminal-next-build-user-report.json) records this evidence without rewriting the earlier validation receipt. Exact build-time API configuration and source identity were not supplied in that terminal output. Start isolated services and complete authenticated browser/visual acceptance using the terminal procedure before public activation. Build success alone does not establish runtime or deployment success.
