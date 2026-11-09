import { useSyncExternalStore } from "react";

export type PracticeMode = "read" | "write";

export type Route =
  | { name: "home" }
  | { name: "practice"; groupId: string; mode: PracticeMode; retry: boolean }
  | { name: "summary"; groupId: string; mode: PracticeMode }
  | { name: "about" };

const homeRoute: Route = { name: "home" };

function decodePathSegment(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "") || "/";
  const queryIndex = raw.indexOf("?");
  const pathname = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : raw.slice(queryIndex + 1);
  const params = new URLSearchParams(query);

  if (pathname === "/") return homeRoute;
  if (pathname === "/about") return { name: "about" };

  const match = pathname.match(/^\/lesson\/([^/]+)\/(read|write|summary)$/);
  if (!match?.[1] || !match[2]) return homeRoute;

  const groupId = decodePathSegment(match[1]);
  if (!groupId?.trim()) return homeRoute;

  const section = match[2];
  if (section === "summary") {
    const mode = params.get("mode");
    return mode === "read" || mode === "write"
      ? { name: "summary", groupId, mode }
      : homeRoute;
  }

  if (section === "read" || section === "write") {
    return {
      name: "practice",
      groupId,
      mode: section,
      retry: params.get("retry") === "1",
    };
  }

  return homeRoute;
}

export function toHash(route: Route): string {
  if (route.name === "home") return "#/";
  if (route.name === "about") return "#/about";

  const groupPath = encodeURIComponent(route.groupId);
  if (route.name === "summary") {
    return `#/lesson/${groupPath}/summary?mode=${route.mode}`;
  }

  const retry = route.retry ? "?retry=1" : "";
  return `#/lesson/${groupPath}/${route.mode}${retry}`;
}

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

let lastHash: string | undefined;
let lastRoute: Route = homeRoute;

function getSnapshot(): Route {
  const hash = window.location.hash;
  if (hash !== lastHash) {
    lastHash = hash;
    lastRoute = parseHash(hash);
  }
  return lastRoute;
}

export function useHashRoute(): Route {
  return useSyncExternalStore(subscribe, getSnapshot, () => homeRoute);
}

export function navigate(route: Route): void {
  window.location.hash = toHash(route);
}
