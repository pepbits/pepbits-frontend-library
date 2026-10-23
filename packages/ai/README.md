# @pepbits/ai

Generic contextual AI configuration, client and UI. Unpublished source package `0.0.0`, copied alongside the original workspace. AI sits above shell; shell never imports AI. No product catalogue, page grants, prompts, endpoint, provider credential or backend implementation is bundled.

## Public API

| Import | API |
| --- | --- |
| `@pepbits/ai/config` | `GATES`, `NARROWING_ONLY`, `resolveAi`, `gatesForPage`, `createAiCatalogue`; access/policy/page-input, use-case/read/source, context/field, config/patch/usage/credential-status types |
| `@pepbits/ai/client` | `createAiClient`, `createAiClientWithRequest`, `createAiAdmin`, `createAiPolicyClient`, `createAiTransport`; pure `assembleContext`, `contextSources`, `redactField`, `mustRedact`, `unredactedFields`; `AiSourcesProvider`, `useAiSources`, `usePublishAiSources`; client/options/request/classifier/source/reply/result types |
| `@pepbits/ai/ui` | `AiProvider`, `useAiHost`, `AiShellExtension`, `AssistantPanel`, `InlineAiAction`, `AiTerminal`, `TransparencyPanel`, `AiAdministration`, `useAssistant`; host/page/assistant/publication types |
| `@pepbits/ai` | Convenience barrel for all three areas |

A client instance exposes bound assembly/redaction/guard/dispatch methods, policy fetch/reset, config fetch/save, credential set/scoped-set/clear/verify and usage fetch. Pure assembly takes `(useCase, pageId, sources, userInput, classificationFor)`; redaction and guard take the classifier as their last required argument. Use the bound client methods to keep one classifier across assembly and dispatch. `AiClassification` returns the existing page-engine `DataClassification` union.

Config is pure and has no shell dependency. Client sources need shell workspace ownership; UI needs shell state. That dependency is intentional within the single AI layer. Use subpaths to avoid importing the UI from a config-only consumer; no boundary-rule change was needed.

## Host wiring and user flow

Mount the existing platform `SessionProvider`, preferences `PreferenceHost` and i18n `LocalizationProvider` first. Reuse the shell guide's navigation/product/brand/workspace setup. Then wrap `ShellProvider` in `AiShellExtension`:

```tsx
import React from 'react';
import {createAiCatalogue, type AiUseCase} from '@pepbits/ai/config';
import {createAiClient, type AiClassification} from '@pepbits/ai/client';
import {AiShellExtension, type AiPage} from '@pepbits/ai/ui';
import {ShellProvider, EnterpriseShell, type ShellProviderProps} from '@pepbits/shell';

export function configureAi(apiBaseUrl: string, classificationFor: AiClassification,
  useCases: readonly AiUseCase[], pages: Readonly<Record<string, AiPage>>) {
  // Call once per host configuration/session boundary, outside render.
  return {client: createAiClient({apiBaseUrl, classificationFor}),
    catalogue: createAiCatalogue(useCases), pages};
}
export function AiWorkspace({ai, shell}: {
  ai: ReturnType<typeof configureAi>; shell: ShellProviderProps;
}) {
  return <AiShellExtension value={{...ai, userEnabled: true, canManageAi: false}}>
    <ShellProvider {...shell}><EnterpriseShell>{shell.children}</EnterpriseShell></ShellProvider>
  </AiShellExtension>;
}
```

For an existing authenticated transport, use `createAiClientWithRequest(request, classificationFor, transport?)`. No base URL is inferred; an explicit empty string in `createAiClient` means same-origin. The platform factory adds session authentication/recovery. The host supplies the same classification policy used by its other egress surfaces. Exact classification lookup and unclassified-key shape fallback preserve the original redaction semantics; unknown fields are **not automatically masked** unless their key matches a sensitive shape. Catalogue field validation rejects empty lists/wildcards and duplicate IDs. Hosts should run the egress tests against their own catalogue too.

`AiShellExtension` fills each root/document ScreenHost's `renderInlineAction` and `publishSources` slots and the shell help-assistant slot. Publication entries have `{id, sources}`; the adapter uses `usePublishAiSources` and retracts them on cleanup. Distinct mounted owners and documents remain isolated. Existing form/worklist engines already publish their displayed data and request inline actions; hosts must declare the matching generic action IDs or render their own actions. A shell without this extension keeps its existing behavior. Custom shells can use `AiProvider` and mount the exported surfaces themselves.

A user opens the assistant, selects an allowed use case, inspects its captured/redacted fields and flow/policy tabs, then confirms. Restricted (`clinical`, the retained wire category) cases require the existing acknowledgment and have no inline affordance. Panel, terminal and inline enumerate one `useAssistant` result. Gates run in order, first denial wins, and named sets only intersect. Missing/disabled build blocks refuse access. `userEnabled` can narrow access. Pages, modules and use cases are host metadata, never a library registry.

The optional administration page displays configuration, limits, usage and credential status. `canManageAi` defaults false; writes additionally require an active, unexpired platform session. It clears entered secrets after submission, including refusals; stored credentials are never populated into an input. Numbers use effective preference formatters and dates use the host localization formatter. Do not pass real secrets in examples or test evidence.

## Security boundary and server configuration

**UI gates are not authorization (PREF-08).** Server dispatch must independently derive tenant/user authority, validate the page/use-case/prompt pair and allowed fields, apply egress/redaction policy, reject prohibited free text/restricted-provider traffic, enforce context/request/token/per-user limits, validate HTTPS provider destinations and refuse credential-bearing redirects. Credential encryption/vault custody, rotation/expiry, durable audit and explicit origins are server responsibilities. The client cannot establish any of those by disabling a control.

The service retains the existing relative routes: `/ai/policy`, `/ai/config`, `/ai/usage`, `/ai/config/credential`, `/ai/config/credential/verify`, `/ai/dispatch`. Scoped credential writes use the same dedicated credential route. Dispatch carries IDs, stable field keys/labels/redacted values and optional user input; it carries no tenant assertion, provider destination, prompt text or credential. The provider endpoint/model shown in administration comes from the configured server, not a library default. Config/status responses must omit secret values at runtime; TypeScript alone cannot sanitize a nonconforming server response.

`fetchAiPolicy` preserves the original null-on-network-failure behavior: the build set may still render, and the server must enforce on dispatch. Per-client caching is keyed by supplied identity; reset it on sign-out/config changes. `AiProvider` resets across session identities. Late requests cannot refill an invalidated cache. The dispatch guard refuses classified sensitive fields lacking a redaction flag before any request, including the echo path. It is a client consistency guard, not protection against a forged browser payload.

HTTP refusals, including 429, preserve the server's error/detail and do not become mock successes. A 409/unreachable service retains the labeled echo fallback. Its historical “nothing left this browser” copy means no provider answer; **a request to the configured application server was attempted**. Do not use that wording as evidence of zero network egress. Model replies remain plain text. The server must treat user input as untrusted and must never log submitted credentials.

## Preferences, localization and styling

Use the existing host providers; AI creates no preference store or localization context. Supply the unchanged `ui.*` messages used by these files from your canonical host catalog. Literal labels also pass through the existing localization provider where the original did so. No production product fallback catalog was copied. Private test messages are canonical English subsets only. Add `packages/ai/src` (or its installed equivalent), shell, patterns, components and UI to the host's Tailwind source list; import token CSS and shell CSS-module support as described in the [shell guide](../shell/README.md). Existing markup, classes, ARIA, keyboard and confirmation behavior are retained; RTL layout/translation review of every AI surface is not claimed.

## Differences from the original

- Three packages become one with `config`, `client`, `ui` subpaths and a root barrel. Imports use the independent lower layers and icons package.
- Global `USE_CASES`, `USE_CASE_IDS`, `getUseCase` and the page registry become a validated host `AiCatalogue` and `AiHost.pages`. No default product use cases or gates are exported. Duplicate IDs now fail at catalogue construction; wildcard/empty-list validation remains.
- The global classification registry becomes a required `AiClassification` callback; algorithms, sensitive-name masks and dispatch guard remain unchanged. No product classification entries ship at runtime.
- Standalone network functions become client/factory methods with explicit platform options or an authenticated request callback. Wire paths/bodies/status handling are unchanged. Policy caching is per instance, with generation fencing for late responses rather than module-global ownership.
- `AiProvider`/`AiShellExtension` replace implicit application wiring. Sources reset across tenant/user/role/branch identity changes. `userEnabled` replaces the hook's constant true input. `canManageAi` replaces the fixed administrator role string and fails closed; the write handler also guards it.
- Administration formats displayed numbers/dates through existing preference/localization services. Its role-specific permission label becomes generic. Root TypeScript's indexed-access annotations have no runtime effect.
- Tests use fictional host catalogs/classification fixtures, `.invalid` transport targets and in-memory fakes. Production prompt/brand/module/page/branch data, provider settings and credentials are intentionally absent.

## Verification and completion boundary

All 13 original generic suites retain 378 cases. Added tests cover catalogue validation, policy races, actual form publication, multi-document isolation, inline/panel slots and host user gating. `src/gates/` ports resolver/mode/context/egress checks and explicitly bounded client checks for limits/credentials/hardening/isolation. The [phase 5b record](../../docs/releases/unreleased/restructure-phase-5b-2026-10-23.md) gives every script-to-test mapping and exact counts.

The original backend limits, credential-file/log/response canary, encrypted storage/audit/provider checks and isolated backend launcher are **not ported or run**: their implementation is outside this library and protected by the task. Client response tests do not certify them. Managed vault integration, approved restricted-data providers and production identity/authorization remain host obligations. No backend, product demos, consumer migration, published package, deployment, native executable or live-provider acceptance is included. Rollback removes this opt-in package/extension; original applications and stored data are unchanged.

## Showcase follow-up: explicit echo transport

The optional third argument of `createAiClientWithRequest` is `"service"` (the compatible default) or `"echo"`. The returned client exposes that transport mode. Echo dispatch runs the same classified-field guard and local mock response without calling the request port. Configuration, usage and policy still use the supplied port: an entirely offline host must supply an in-memory port for those reads, as the showcase does. Echo does not enforce production limits or authorize requests.

`AssistantPanel` passes the explicit echo mode to `TransparencyPanel simulation`. Simulation confirms captured fields without pretending that a provider credential exists; ordinary service mode still requires configured credentials. Empty context and restricted-use-case acknowledgement remain enforced. The extension memoizes its ScreenHost value so workspace draft updates and publications do not repeatedly propagate an unchanged bridge. Turning off `userEnabled` removes inline/publication slots, retracts sources, suppresses assistant policy/configuration requests and closes the panel; administration should only be mounted when the host enables it. The showcase supplies read-only fictional administration and starts AI off. Tests cover no-request echo dispatch, unredacted-field refusal, simulation confirmation guards, and no policy request while off. See the [follow-up receipt](../../docs/releases/unreleased/restructure-phase-6a-2026-10-23.md#follow-up--full-shell-and-ai-pages).
