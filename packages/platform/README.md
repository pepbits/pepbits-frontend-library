# @pepbits/platform

Host-configured sessions, recovery/monitoring, navigation, windows and device transports. This `0.1.0` ESM package peers on React 19 or later and depends on `@pepbits/data`. No environment lookup, default host, product account list or native runtime import is included.

Published at **0.1.0** on GitHub Packages. Install with `npm install @pepbits/platform` after adding the `@pepbits` registry `.npmrc` and a read token — see the [developer quick start](../../docs/development/PUBLISHING.md#developer-quick-start-for-product-apps). Working examples: the [component showcase](../../demo-apps/showcase/README.md) and the [demo apps](../../demo-apps/README.md).

## Public API

The root barrel exports every area; subpaths keep host wiring explicit:

| Export | Public surface |
| --- | --- |
| `@pepbits/platform/auth` | `SessionUser`, `SessionStatus`, `SessionValue`, `SessionOptions`, `SessionProviderProps`, `SessionProvider`, `HostSessionProvider`, `useSession`, `readToken`, `expireCurrentSession`, `createAuthedFetch`, `recoveryRequest`, `RequestFailure` |
| `@pepbits/platform/monitoring` | `SentinelKind`, `SentinelEvent`, `sanitizeSentinelEvent`, `SentinelQueue`, `reportOperationFailure`, `reportSentinelFailure`, `subscribeSentinel`, `sentinelReference` |
| `@pepbits/platform/devices` | `DeviceTicket`, `DeviceAcknowledgement`, `DeviceConnector`, `createDeviceConnector` |
| `@pepbits/platform/navigation` | `NavigationTarget`, `NavigationPort`, `targetKey`, `NavigationProvider`, `useNavigation` |
| `@pepbits/platform/windows` | `DetachedWindowRequest`, `WindowPort`, `NULL_WINDOW_PORT`, `WindowPortProvider`, `useWindowPort` |

## Host flow and integration

Install at the repository root with `npm install`. Both session provider and authenticated request factory require an explicit `apiBaseUrl`; `''` explicitly selects same-origin paths. No trailing-slash normalization is added: pass the desired prefix without a trailing slash. `fetch` is optional and defaults to `globalThis.fetch`. Configuration is per provider/client, not a module-global API singleton.

```tsx
import React from 'react';
import {SessionProvider, createAuthedFetch} from '@pepbits/platform/auth';
import {NavigationProvider, type NavigationPort} from '@pepbits/platform/navigation';
import {WindowPortProvider, NULL_WINDOW_PORT, type WindowPort} from '@pepbits/platform/windows';
import {createHttpRecordAdapter} from '@pepbits/data';

export function services(apiBaseUrl: string, hostFetch: typeof fetch) {
  const request = createAuthedFetch({apiBaseUrl, fetch: hostFetch});
  return {request, records: createHttpRecordAdapter(request)};
}

export function Host({apiBaseUrl, hostFetch, navigation, windows = NULL_WINDOW_PORT, children}: {
  apiBaseUrl: string; hostFetch: typeof fetch; navigation: NavigationPort;
  windows?: WindowPort; children: React.ReactNode;
}) {
  return <SessionProvider apiBaseUrl={apiBaseUrl} fetch={hostFetch}>
    <NavigationProvider value={navigation}>
      <WindowPortProvider value={windows}>{children}</WindowPortProvider>
    </NavigationProvider>
  </SessionProvider>;
}
```

1. The provider validates any stored token with `/auth/me` before declaring the session authenticated. Failure clears it; no token starts anonymous without a request. Login posts username/password to `/auth/login`; tenant identity comes only from the server.
2. `useSession()` exposes status/user, login/logout and the retained-workspace `expired` flag. A 401 from `createAuthedFetch` locks the current workspace; the same identity can reauthenticate without losing edits. Different identities cannot unlock it. Render recovery using host catalogs and shared components.
3. Logout clears local state first and calls `/auth/logout` best-effort. Request generations protect against late validation/login responses and cross-window logout. Validation/login deadlines remain 30 seconds; logout retains its original best-effort behavior without a new deadline.
4. `createAuthedFetch(options)` returns the old request-shaped function, attaches the stored bearer, preserves caller headers, and returns a plain `Response`. Monitoring 401s do not invalidate the session; stale 401s cannot remove newer tokens. No token or credential is logged.
5. Cookie/BFF applications use `HostSessionProvider` with their verified `SessionValue` and their own request function. This provider does not use the token store or initiate requests. `useSession` and `useNavigation` throw when required providers are absent; windows default to the unavailable null port.

The token store remains origin-wide, not per client/base URL. Use one bearer identity/API trust boundary per browser origin. Per-client transport configuration does not isolate credentials; hosts requiring other session ownership should use `HostSessionProvider`. Changing the provider's URL/fetch revalidates and invalidates earlier validation generations. Host callbacks should be stable across renders.

## Ports and monitoring

The host implements `NavigationPort` using its router or desktop tabs. `targetKey` retains module/page/mode/record identity and ignores display title. The host supplies `WindowPort` for a desktop runtime; Tauri calls, title sanitization and native permissions stay in that host. Web hosts can use `NULL_WINDOW_PORT` (`available: false`, `open: false`, other operations no-op). Availability controls whether detach is offered; it is not authorization.

```ts
import {createDeviceConnector, type DeviceAcknowledgement} from '@pepbits/platform/devices';
export function devices(call: (method: 'submit' | 'status', payload: unknown,
  signal?: AbortSignal) => Promise<DeviceAcknowledgement>) {
  return createDeviceConnector(call);
}
```

Device tickets contain references, never arbitrary commands; the connector rejects expired tickets and mismatched acknowledgements. Hosts own pairing, authentication, allowlists, drivers and spooler access.

`recoveryRequest` preserves cancellation, buffers JSON within the request deadline, forwards stream cancellation after headers, reports safe references and never retries writes automatically. It skips monitoring routes to prevent recursion. `RequestFailure` is the identical data-layer class; display mapping stays in components. `SentinelQueue` sanitizes an allowlist, bounds pending events to 50, sends batches of 10, deduplicates selected failures and backs off to 60 seconds. Hosts supply delivery, page/release/platform metadata and a flush schedule. `subscribeSentinel` has one active sink and up to ten early failures; unsubscribe and stop the queue on teardown. `reportOperationFailure` dispatches `pepbits-sentinel`, which a host listener can forward. No runtime/global-error observer or service endpoint is installed automatically, and no raw exception, request body or form value belongs in an event.

## Preferences, permissions and localization

No rendered product controls, persisted preferences or formatting defaults are introduced. Hosts supply effective preferences, locked control states, translations for `recovery.*` and other existing messages, accessible forms, and workspace retention UI. Server identity and authorization remain authoritative; role/branch strings are opaque host values. Platform capability checks do not grant permissions. These source-only services do not require catalog/example regeneration in the protected workspace.

## Differences from the original

- Use `@pepbits/platform` or its subpaths instead of auth/platform-ports imports. Existing session, navigation, window and generic device types/behaviors are preserved, except the explicit differences below.
- Removed module-level `API_BASE`, environment reads and the hardcoded host. `SessionProvider` now requires `apiBaseUrl` and accepts optional `fetch`; new `SessionOptions`/`SessionProviderProps` describe these inputs. The standalone `authedFetch` export becomes `createAuthedFetch(options)`, whose returned function retains `(path, init?)` and recovery semantics. There is no default base URL.
- Generic namespace replaces product-branded browser keys/events: `nexora-session-token`, `nexora-session-expired`, `nexora-session-invalidated`, `nexora-sentinel` become `pepbits-session-token`, `pepbits-session-expired`, `pepbits-session-invalidated`, `pepbits-sentinel`. Token handling and event behavior otherwise match. No automatic migration or reading of the old token store occurs; opting into the new package requires sign-in, and host event listeners must use the new name. Existing consumers remain untouched.
- `RequestFailure` lives in data and is re-exported here with the same constructor, name/message and status/reference fields. Recovery's timeout, cancellation, buffering, stream and diagnostic logic is unchanged.
- `DEMO_ACCOUNTS` is omitted. Phase 4c adds the previously omitted identity capture envelope using `subjectReference`; product verification and authentication remain host-owned.
- Source comments referencing product role/branch catalogs now describe host values. Test identities and routes use synthetic generic host fixtures. No other retained prop/signature changes.

## Intentionally not included and acceptance

No product landing/navigation implementation, demo accounts, product identity/authentication workflow, direct Tauri imports, backend integration, token migration or AI port. School landing and web-navigation suites exercise application routes, product catalogs and Next.js hosts; they are excluded. The generic ports suite is ported in full.

Ported tests: session 30 of 32 (two demo-account cases omitted), recovery 9, Sentinel 5, devices 1, ports 17. Additional tests cover host transport injection, explicit same-origin use, client configuration, stale validation after host changes, shared error identity and monitoring recursion. Run `npm run typecheck -w @pepbits/platform` and `npm test -w @pepbits/platform`. See the [phase 3 record](../../docs/releases/unreleased/restructure-phase-3-2026-10-22.md) for measured totals and per-file inventory. jsdom/mocked fetch and injected ports do not establish browser/native execution, live identity-provider/device integration or deployment.

## Controlled session composition (phase 6a)

`SessionProvider` also accepts `{value: SessionValue, children}`. This uses the existing `HostSessionProvider` contract without reading/writing tokens, installing storage listeners or calling fetch. Host snapshot updates remain authoritative. The original `{apiBaseUrl, fetch?, children}` signature is unchanged. This lets a local gallery compose the same provider chain with a fictional in-memory session; a production host supplies its verified session. The session suite covers controlled rerenders and absence of network/token access.

## Phase 4c device workflow bridges

`./devices` adds `IdentityCaptureTicket`, `IdentityCaptureResult`, `IdentityDeviceConnector` and `createIdentityDeviceConnector`, ported with `subjectReference` replacing the product-specific field. Invalid/expired tickets, mismatched challenge IDs and invalid opaque assertion references are rejected; unrelated response properties are stripped. Provider signatures, consent and authorization remain backend responsibilities.

`./device-workflows` (also root exports) adds `withDeviceConnector(adapter, host)` and `withIdentityConnector(adapter, host)`. Hosts supply a connector, an authenticated ticket callback, and `acknowledge` or `verify`. A null ticket preserves browser/demo handling. Non-null tickets must match the returned job/device or attempt/subject/device. Only dispatch/start passes through the port. The original command, including operation identity, reaches the adapter and acknowledgement callback unchanged; no automatic retry is added. Scope bridge instances to the verified host session. No device URL, native import, driver or authentication decision is supplied. The [phase 4c record](../../docs/releases/unreleased/restructure-phase-4c-2026-10-23.md) distinguishes simulated port tests from real hardware acceptance.

## Configured application HTTP and preferences

Phase 6c-1 extracts the shared demo host contracts into `@pepbits/platform/http` (`Request`, `RequestContext`, `useRequest`, `createRequest`, `readJson`, `ApiFailure`) and `@pepbits/platform/preference-service` (`loadPreferences`, `savePreferences`). A host supplies the base URL and product identity; the platform authenticated transport owns tokens. Relative URLs are checked and malformed JSON preserves a structured failure. Preference reads/writes carry accepted revisions and tenant policy. Healthcare and ERP consume these same exports; their mocked host/adapter suites verify serial updates, failure retention and scope. No product navigation or server origin is embedded here.

Phase 6c-2 adds direct `http.test.tsx` and `preference-service.test.ts` coverage of configured authenticated requests, headers, relative-path guards, response errors, missing context, policy parsing, lock/allowed-value filtering and revision-bearing writes. `SessionUser.permissions` is an optional readonly array of server-issued grants for host presentation; it never replaces backend authorization.

## Server-Sent Events subscription (phase 6e-5)

`@pepbits/platform/event-stream` exports `subscribeEventStream`, `useEventStream`, `EventStreamStatus`, `EventStreamHandlers`, `EventStreamOptions` and `EventSourceLike`. The host supplies the stream URL (no origin is inferred), named-event handlers and an optional readiness event; the subscription reports `connecting`, `live` and `offline`, parses JSON payloads (non-JSON text is passed through), closes the source on error and reconnects after a bounded delay (4 seconds by default). Events from a replaced or stopped source are ignored, and nothing fires after unsubscribe. The hook reads handlers through a ref, so new handler functions do not reconnect; a null URL disconnects. An injectable `create` factory supports native hosts and tests. Streams are notification channels only: hosts must re-read authoritative state over their authenticated HTTP transport, and must not treat an open stream as authorization. Four tests cover readiness/parsing, error/reconnect timing, stale-source fencing and the hook. CareGrid uses it for live scheduling updates; see the [phase 6e-5 record](../../docs/releases/unreleased/restructure-phase-6e-5-2026-10-24.md).
