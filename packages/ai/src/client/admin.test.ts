import { beforeEach, describe, expect, test, vi } from "vitest";

const authedFetch = vi.hoisted(() => vi.fn());
import {createAiAdmin} from "./admin";
import {classificationFor} from "../test/catalog";

const {
  clearAiCredential,
  fetchAiConfig,
  fetchAiUsage,
  saveAiConfig,
  setAiCredential,
  setAiScopedCredential,
  verifyAiCredential,
} = createAiAdmin(authedFetch);

/**
 * The administration surface. Two properties matter more than the plumbing: a
 * provider secret can only ever travel outward, and the service's own refusals
 * reach the administrator unparaphrased -- they explain WHY something is
 * unavailable ("no vault", "no authorization layer"), and a summary loses the
 * reason.
 */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const unreachable = () => ({
  /* See policy.test.ts: a genuinely rejected mock is reported by vitest as an
     unhandled error against whichever test is running when it surfaces. */
  then: (_resolve: unknown, reject: (error: unknown) => void) => reject(new TypeError("Failed to fetch")),
});

beforeEach(() => {
  authedFetch.mockClear();
  authedFetch.mockReturnValue(undefined);
});

const sent = () => authedFetch.mock.calls[0]!;

describe("reading", () => {
  test("returns the service's config on success", async () => {
    authedFetch.mockResolvedValue(json(200, { provider: "example-provider", credential: { present: true } }));
    const result = await fetchAiConfig();
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ provider: "example-provider" });
    expect(sent()[0]).toBe("/ai/config");
  });

  test("reads usage from its own endpoint, not from the config", async () => {
    /* Usage moves constantly and the config does not. One endpoint for both
       would either cache spend or defeat caching the config. */
    authedFetch.mockResolvedValue(json(200, { spend: 12 }));
    await fetchAiUsage();
    expect(sent()[0]).toBe("/ai/usage");
  });
});

describe("refusals", () => {
  test("keeps the service's message and detail exactly as written", async () => {
    authedFetch.mockResolvedValue(json(501, { error: "No key vault.", detail: "The secret is plaintext JSON on disk." }));
    const result = await fetchAiConfig();
    expect(result).toMatchObject({
      ok: false,
      status: 501,
      error: "No key vault.",
      detail: "The secret is plaintext JSON on disk.",
    });
  });

  test("an unreachable API is reported as such, with no status to misread", async () => {
    authedFetch.mockImplementation(() => unreachable() as unknown as Promise<Response>);
    const result = await fetchAiConfig();
    expect(result).toEqual({ ok: false, status: 0, error: "Could not reach the API." });
  });

  test("a failure with no body is still a failure", async () => {
    authedFetch.mockResolvedValue(new Response("<html>gateway</html>", { status: 502 }));
    const result = await fetchAiConfig();
    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
  });

  /* 204 has no body. Parsing one yields a syntax error, and reporting that as a
     failure would turn every successful save into an error on screen. */
  test("a 204 is a success carrying nothing", async () => {
    authedFetch.mockResolvedValue(new Response(null, { status: 204 }));
    /* toStrictEqual, not toEqual: without the 204 branch the result carries an
       explicit `data: undefined`, which toEqual treats as equal to no key at
       all -- so the looser form passed with the branch deleted. */
    expect(await clearAiCredential()).toStrictEqual({ ok: true, status: 204 });
  });
});

describe("the credential", () => {
  test("is written to its own endpoint, and only written", async () => {
    authedFetch.mockResolvedValue(new Response(null, { status: 204 }));
    await setAiCredential("sk-not-a-real-key");
    const [path, init] = sent();
    expect(path).toBe("/ai/config/credential");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ secret: "sk-not-a-real-key" });
  });

  test("a scoped credential uses the same endpoint and the same contract", async () => {
    /* A second store for speech keys would drift from this one, and it would be
       the copy with the weaker rules. */
    authedFetch.mockResolvedValue(new Response(null, { status: 204 }));
    await setAiScopedCredential("speech", "sk-speech");
    const [path, init] = sent();
    expect(path).toBe("/ai/config/credential");
    expect(JSON.parse(init.body)).toEqual({ scope: "speech", secret: "sk-speech" });
  });

  test("clearing it is a DELETE with no body", async () => {
    authedFetch.mockResolvedValue(new Response(null, { status: 204 }));
    await clearAiCredential();
    const [path, init] = sent();
    expect(path).toBe("/ai/config/credential");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  /* There is no getAiCredential, and there should never be one. A secret that
     can be read back is a secret that ends up in a screenshot. */
  test("verifying returns a status, never the secret", async () => {
    authedFetch.mockResolvedValue(json(200, { present: true, lastError: null, rotatedAt: "2026-01-01" }));
    const result = await verifyAiCredential();
    expect(sent()[1].method).toBe("POST");
    expect(JSON.stringify(result)).not.toMatch(/secret|sk-/);
  });

  test("a saved config cannot carry a secret", async () => {
    authedFetch.mockResolvedValue(new Response(null, { status: 204 }));
    await saveAiConfig({ provider: "example-provider", endpoint: "https://provider.example.invalid" } as never);
    const [path, init] = sent();
    expect(path).toBe("/ai/config");
    expect(init.method).toBe("PUT");
    /* The patch type omits `credential` by construction; this pins that the
       request built from it carries nothing resembling one either. */
    expect(JSON.parse(init.body)).not.toHaveProperty("credential");
    expect(init.body).not.toMatch(/secret|sk-/);
  });
});
