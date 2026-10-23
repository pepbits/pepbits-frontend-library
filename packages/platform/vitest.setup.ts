import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

/* findBy and waitFor give up after 1 s by default; under a parallel workspace
   run on a busy machine that produces false failures. See packages/patterns. */
import { configure as configureTestingLibrary } from "@testing-library/react";
configureTestingLibrary({ asyncUtilTimeout: 5000 });
