"use client";
import { useApiResource, useLivePoll } from "../../shared/hooks";
import { useTeleconsultClient } from "./api";

export { useDebounced, useHotkey, useNow, localId } from "../../shared/hooks";

export function useApi<T>(path: string | null, opts: { poll?: number } = {}) {
  return useApiResource<T>(useTeleconsultClient(), path, opts);
}

/** Authenticated `/current` polling (no EventSource, no token in the URL). */
export function useLiveFrames<T>(path: string | null, onFrames: (frames: T[]) => void, opts: { intervalMs: number; isDone?: (frame: T) => boolean }) {
  return useLivePoll<T>(useTeleconsultClient(), path, onFrames, opts);
}
