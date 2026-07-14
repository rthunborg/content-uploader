/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DelayedSkeleton, SKELETON_DELAY_MS } from "./delayed-skeleton";

describe("DelayedSkeleton", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps the public skeleton absent at 199 ms and presents it at 200 ms", () => {
    vi.useFakeTimers();
    render(<DelayedSkeleton />);
    act(() => vi.advanceTimersByTime(199));
    expect(screen.queryByTestId("delayed-skeleton")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    const skeleton = screen.getByTestId("delayed-skeleton");
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.className).toContain("motion-reduce:animate-none");
    expect(SKELETON_DELAY_MS).toBe(200);
  });

  it("cancels the timer when unmounted", () => {
    vi.useFakeTimers();
    const clearTimer = vi.spyOn(globalThis, "clearTimeout");
    const view = render(<DelayedSkeleton />);
    view.unmount();
    expect(clearTimer).toHaveBeenCalledOnce();
    expect(() => act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS))).not.toThrow();
    clearTimer.mockRestore();
  });

  it("replaces the pending timer when delay changes", () => {
    vi.useFakeTimers();
    const view = render(<DelayedSkeleton delay={500} />);
    act(() => vi.advanceTimersByTime(100));
    view.rerender(<DelayedSkeleton delay={200} />);
    act(() => vi.advanceTimersByTime(199));
    expect(screen.queryByTestId("delayed-skeleton")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("delayed-skeleton")).toBeTruthy();
  });
});
