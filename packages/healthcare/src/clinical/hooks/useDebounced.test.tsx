import {afterEach, describe, expect, it, vi} from "vitest";
import {act, renderHook} from "@testing-library/react";
import {useDebounced} from "./useDebounced";
afterEach(() => vi.useRealTimers());
describe("useDebounced", () => {
  it("cancels obsolete updates and releases the latest value only after its delay", () => {
    vi.useFakeTimers();
    const {result, rerender, unmount} = renderHook(({value}) => useDebounced(value, 100), {initialProps: {value: "a"}});
    rerender({value: "b"});
    act(() => vi.advanceTimersByTime(50));
    rerender({value: "c"});
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe("c");
    rerender({value: "d"});
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("debounces function values without invoking them as state updaters", () => {
    vi.useFakeTimers();
    const first = vi.fn(), next = vi.fn();
    const {result, rerender} = renderHook(({value}) => useDebounced(value, 10), {initialProps: {value: first}});
    rerender({value: next});
    act(() => vi.advanceTimersByTime(10));
    expect(result.current).toBe(next);
    expect(first).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
