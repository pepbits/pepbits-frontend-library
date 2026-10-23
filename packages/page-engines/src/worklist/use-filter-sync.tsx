"use client";

import { useCallback, useMemo, useState } from "react";
import {fromQuery, partitionFilters, storableFilters, toQuery, type FilterDefinition, type FilterValues} from "../types";

/**
 * Filter state, split by classification.
 *
 * One set of values on screen, two destinations behind it: the operational half
 * goes to the URL and to device storage, and everything else stays in memory
 * for the life of the component and travels only in a POST body.
 *
 * The writers are injected rather than called directly, which is what makes the
 * guarantee testable: the test asserts on what LEAVES this hook, not on what it
 * happens to hold.
 */
export function useFilterSync({ definitions, pageId, initialQuery, initialStored, writeUrl, writeStore }: {
  definitions: FilterDefinition[];
  pageId: string;
  initialQuery?: URLSearchParams;
  initialStored?: FilterValues;
  writeUrl: (query: string) => void;
  writeStore: (values: FilterValues) => void;
}) {
  const [values, setValues] = useState<FilterValues>(() => ({
    /* Both sources are filtered on the way IN as well as on the way out.
       A URL is user input — someone can type ?mrn= by hand — and storage is a
       file on the user's disk that may hold values written by a build from
       before this rule existed. Reading either without the allowlist would
       restore exactly what the allowlist was there to prevent. */
    ...(initialStored ? storableFilters(definitions, initialStored) : {}),
    ...(initialQuery ? fromQuery(definitions, initialQuery) : {}),
  }));

  const publish = useCallback((next: FilterValues) => {
    writeUrl(toQuery(definitions, next).toString());
    writeStore(storableFilters(definitions, next));
  }, [definitions, writeUrl, writeStore]);

  const set = useCallback((key: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (!value.trim()) delete next[key];
      publish(next);
      return next;
    });
  }, [publish]);

  /* Clears both halves. A reset that leaves an invisible sensitive filter
     applied is worse than none: the list is filtered and nothing on screen
     says why. */
  const reset = useCallback(() => {
    setValues({});
    publish({});
  }, [publish]);

  const split = useMemo(() => partitionFilters(definitions, values), [definitions, values]);

  return {
    values,
    /** For the address bar and for storage. */
    urlSafe: split.urlSafe,
    /** For a POST body. Never serialised into a link. */
    sensitive: split.sensitive,
    /** What is being held back, so the UI can say a link will not carry it. */
    sensitiveKeys: split.sensitiveKeys.sort(),
    pageId,
    set,
    reset,
  };
}
