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
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

// jsdom has no native modal top layer; browser focus/inert behavior is not claimed.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) HTMLDialogElement.prototype.showModal = function () {this.setAttribute("open", "");};
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.close) HTMLDialogElement.prototype.close = function () {this.removeAttribute("open");};

/* findBy and waitFor give up after 1 s by default; under a parallel workspace
   run on a busy machine that produces false failures. See packages/patterns. */
import { configure as configureTestingLibrary } from "@testing-library/react";
configureTestingLibrary({ asyncUtilTimeout: 5000 });
