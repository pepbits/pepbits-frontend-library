"use client";
import {useEffect, useState} from "react";

/** Debounces a value; cancels obsolete timers and pending updates when unmounted. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState<T>(() => value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(() => value), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
