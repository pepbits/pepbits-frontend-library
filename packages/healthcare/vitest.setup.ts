import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

/* Without this a component from one test is still mounted during the next, and
   getByText finds the previous test's element — a false pass that looks like a
   working test. */
afterEach(cleanup);

/* findBy and waitFor give up after 1 s by default. The lifecycle screens settle
   well within that alone, but not always when every workspace's suite runs in
   parallel on a busy machine; a longer ceiling removes those false failures
   without slowing passing tests. */
configure({ asyncUtilTimeout: 5000 });

/* jsdom implements no layout, so it has no scrollIntoView -- and a component
   that keeps a transcript pinned to the bottom calls it on every append. The
   result is a TypeError from inside a state update, which surfaces as every
   test in the file failing for a reason unrelated to any of them. Stubbed
   rather than guarded in the components: not scrolling is exactly right in a
   test, and a `?.` in the source would be there for the runner's benefit. */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
