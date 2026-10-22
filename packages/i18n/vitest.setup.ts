import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/* Without this a component from one test is still mounted during the next, and
   getByText finds the previous test's element — a false pass that looks like a
   working test. */
afterEach(cleanup);

/* jsdom implements no layout, so it has no scrollIntoView -- and a component
   that keeps a transcript pinned to the bottom calls it on every append. The
   result is a TypeError from inside a state update, which surfaces as every
   test in the file failing for a reason unrelated to any of them. Stubbed
   rather than guarded in the components: not scrolling is exactly right in a
   test, and a `?.` in the source would be there for the runner's benefit. */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
