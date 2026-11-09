import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { navigate, parseHash, toHash, useHashRoute } from "./hash-router";

beforeEach(() => {
  window.location.hash = "#/";
});

describe("hash router", () => {
  it("parses home and practice routes", () => {
    expect(parseHash("#/")).toEqual({ name: "home" });
    expect(parseHash("#/lesson/lesson-1/read")).toEqual({
      name: "practice",
      groupId: "lesson-1",
      mode: "read",
      retry: false,
    });
    expect(parseHash("#/lesson/lesson-3/write?retry=1")).toEqual({
      name: "practice",
      groupId: "lesson-3",
      mode: "write",
      retry: true,
    });
  });

  it("parses summary and about routes", () => {
    expect(parseHash("#/lesson/lesson-1/summary?mode=write")).toEqual({
      name: "summary",
      groupId: "lesson-1",
      mode: "write",
    });
    expect(parseHash("#/about")).toEqual({ name: "about" });
  });

  it("falls back to home for invalid syntax", () => {
    expect(parseHash("#/lesson/unknown/magic")).toEqual({ name: "home" });
    expect(parseHash("#/lesson//read")).toEqual({ name: "home" });
    expect(parseHash("#/lesson/lesson-1/read/extra")).toEqual({ name: "home" });
    expect(parseHash("#/lesson/lesson-1/summary?mode=magic")).toEqual({
      name: "home",
    });
  });

  it("encodes group IDs and navigates with the canonical hash", () => {
    const route = {
      name: "practice" as const,
      groupId: "园地/2",
      mode: "write" as const,
      retry: true,
    };
    const hash = "#/lesson/%E5%9B%AD%E5%9C%B0%2F2/write?retry=1";

    expect(toHash(route)).toBe(hash);
    expect(parseHash(hash)).toEqual(route);

    navigate(route);
    expect(window.location.hash).toBe(hash);
  });

  it("updates on hashchange and removes its subscription on unmount", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useHashRoute());
    const listener = addEventListener.mock.calls.find(
      ([type]) => type === "hashchange",
    )?.[1];

    expect(typeof listener).toBe("function");
    expect(result.current).toEqual({ name: "home" });

    act(() => {
      window.location.hash = "#/about";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current).toEqual({ name: "about" });

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("hashchange", listener);
  });

  it("uses the home route as the server snapshot", () => {
    window.location.hash = "#/about";
    function RouteProbe() {
      return createElement("output", null, useHashRoute().name);
    }

    expect(renderToString(createElement(RouteProbe))).toContain("home");
  });

  it("round-trips every route form", () => {
    const routes = [
      { name: "home" as const },
      { name: "about" as const },
      {
        name: "practice" as const,
        groupId: "garden-2",
        mode: "write" as const,
        retry: true,
      },
      {
        name: "summary" as const,
        groupId: "lesson-1",
        mode: "read" as const,
      },
    ];

    for (const route of routes) {
      expect(parseHash(toHash(route))).toEqual(route);
    }
  });
});
