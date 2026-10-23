import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AiPolicy } from "@pepbits/ai/config";

const authedFetch = vi.hoisted(() => vi.fn());
import {createAiPolicyClient} from "./policy";
import {classificationFor} from "../test/catalog";

const { fetchAiPolicy, resetAiPolicy } = createAiPolicyClient(authedFetch);

/**
 * The gate policy is cached in module scope, which makes the cache itself the
 * risk: the wrong tenant's gates surviving a sign-in as someone else would
 * render an assistant the new account is not entitled to.
 */

/* A real AiPolicy, not a cast: `tenantId` doubles as the marker telling one
   fetched answer from another, so the tests below distinguish them by the one
   field the server derives and the client never asserts. */
const policy = (tenantId: string): AiPolicy => ({
  tenantId,
  global: {},
  modules: {},
  pages: {},
  useCases: {},
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

/* A thenable that fails without ever being a rejected promise. vitest derives a
   promise from whatever a spy returns and does not handle its rejection, so a
   real one is reported as an unhandled error against an unrelated test. */
const unreachable = () => ({
  then: (_resolve: unknown, reject: (error: unknown) => void) => reject(new TypeError("Failed to fetch")),
});

beforeEach(() => {
  authedFetch.mockClear();
  authedFetch.mockReturnValue(undefined);
  resetAiPolicy();
});

describe("fetchAiPolicy", () => {
  test("asks the service once and answers the rest from memory", async () => {
    authedFetch.mockResolvedValue(ok(policy("first")));
    expect(await fetchAiPolicy("u1")).toEqual(policy("first"));
    expect(await fetchAiPolicy("u1")).toEqual(policy("first"));
    expect(authedFetch).toHaveBeenCalledTimes(1);
  });

  test("reads the policy endpoint", async () => {
    authedFetch.mockResolvedValue(ok(policy("first")));
    await fetchAiPolicy("u1");
    expect(authedFetch).toHaveBeenCalledWith("/ai/policy");
  });

  /* The cache is keyed by user. Signing in as someone else must not inherit the
     previous account's gates out of a module-level variable that nothing on the
     page owns. */
  test("a different user does not inherit the cached policy", async () => {
    authedFetch.mockResolvedValue(ok(policy("first")));
    await fetchAiPolicy("u1");
    authedFetch.mockResolvedValue(ok(policy("second")));
    expect(await fetchAiPolicy("u2")).toEqual(policy("second"));
    expect(authedFetch).toHaveBeenCalledTimes(2);
  });

  test("switching back re-asks rather than reviving the first answer", async () => {
    authedFetch.mockResolvedValue(ok(policy("first")));
    await fetchAiPolicy("u1");
    authedFetch.mockResolvedValue(ok(policy("second")));
    await fetchAiPolicy("u2");
    authedFetch.mockResolvedValue(ok(policy("third")));
    expect(await fetchAiPolicy("u1")).toEqual(policy("third"));
  });

  /* A failure resolves to null, NOT to a denial. Failing closed here would make
     the assistant vanish on a network blip, which teaches people to distrust
     the gating rather than the network -- and it would not be a security gain,
     because the server re-checks at dispatch. */
  test("a rejected request resolves to null rather than a denial", async () => {
    authedFetch.mockResolvedValue(new Response("{}", { status: 503 }));
    expect(await fetchAiPolicy("u1")).toBeNull();
  });

  test("an unreachable service resolves to null rather than throwing", async () => {
    authedFetch.mockImplementation(() => unreachable() as unknown as Promise<Response>);
    await expect(fetchAiPolicy("u1")).resolves.toBeNull();
  });

  test("a failure is not cached, so the next attempt tries again", async () => {
    authedFetch.mockResolvedValue(new Response("{}", { status: 503 }));
    expect(await fetchAiPolicy("u1")).toBeNull();
    authedFetch.mockResolvedValue(ok(policy("recovered")));
    expect(await fetchAiPolicy("u1")).toEqual(policy("recovered"));
  });

  /* Every allowed page asks the same question. Without the shared inflight
     promise a first render fans out one request per gate. */
  test("callers that arrive together share one request", async () => {
    authedFetch.mockResolvedValue(ok(policy("first")));
    const answers = await Promise.all([fetchAiPolicy("u1"), fetchAiPolicy("u1"), fetchAiPolicy("u1")]);
    expect(authedFetch).toHaveBeenCalledTimes(1);
    expect(answers.every((answer) => answer?.tenantId === "first")).toBe(true);
  });
});

describe("resetAiPolicy", () => {
  test("drops the cache, so the next call asks again", async () => {
    authedFetch.mockResolvedValue(ok(policy("first")));
    await fetchAiPolicy("u1");
    resetAiPolicy();
    authedFetch.mockResolvedValue(ok(policy("saved")));
    expect(await fetchAiPolicy("u1")).toEqual(policy("saved"));
    expect(authedFetch).toHaveBeenCalledTimes(2);
  });
});

test('a late response cannot populate the next identity cache',async()=>{
 let finish!:(response:Response)=>void;
 authedFetch.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));
 const old=fetchAiPolicy('old');authedFetch.mockResolvedValue(ok(policy('new')));
 expect(await fetchAiPolicy('new')).toEqual(policy('new'));
 finish(ok(policy('old')));expect(await old).toBeNull();
 expect(await fetchAiPolicy('new')).toEqual(policy('new'));expect(authedFetch).toHaveBeenCalledTimes(2);
});
test('reset during a request invalidates its result',async()=>{
 let finish!:(response:Response)=>void;authedFetch.mockImplementationOnce(()=>new Promise<Response>(resolve=>{finish=resolve;}));
 const old=fetchAiPolicy('same');resetAiPolicy();finish(ok(policy('old')));expect(await old).toBeNull();
 authedFetch.mockResolvedValue(ok(policy('fresh')));expect(await fetchAiPolicy('same')).toEqual(policy('fresh'));
});
