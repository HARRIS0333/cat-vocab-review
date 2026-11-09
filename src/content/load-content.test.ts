import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLoadCacheForTests,
  loadCharacter,
  loadContent,
} from "./load-content";
import { makeContentFixture } from "../test/fixtures";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("content loader", () => {
  beforeEach(() => {
    clearLoadCacheForTests();
    vi.unstubAllEnvs();
  });

  it("loads content once from the configured base path and reuses its promise", async () => {
    const content = makeContentFixture();
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(content));

    await expect(loadContent(fetcher as unknown as typeof fetch)).resolves.toEqual(
      content,
    );
    await loadContent(fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      `${import.meta.env.BASE_URL}content.json`,
    );
  });

  it("keeps a subpath base URL when building content URLs", async () => {
    vi.stubEnv("BASE_URL", "/grades/");
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(makeContentFixture()));

    await loadContent(fetcher as unknown as typeof fetch);

    expect(String(fetcher.mock.calls[0]?.[0])).toBe("/grades/content.json");
  });

  it("loads character data from the base path with an encoded filename", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ strokes: ["M 0 0"], medians: [[[234, 510]]] }),
    );

    await expect(
      loadCharacter("你", fetcher as unknown as typeof fetch),
    ).resolves.toEqual({
      strokes: ["M 0 0"],
      medians: [[{ x: 234, y: 510 }]],
    });

    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      `${import.meta.env.BASE_URL}characters/%E4%BD%A0.json`,
    );
  });

  it("caches character loads by character", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({ strokes: ["M 0 0"], medians: [[[234, 510]]] }),
    );

    await Promise.all([
      loadCharacter("你", fetcher as unknown as typeof fetch),
      loadCharacter("你", fetcher as unknown as typeof fetch),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("clears a failed content load so retry uses a fresh request", async () => {
    const content = makeContentFixture();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(content));

    await expect(loadContent(fetcher as unknown as typeof fetch)).rejects.toThrow(
      "内容加载失败（503）",
    );
    await expect(loadContent(fetcher as unknown as typeof fetch)).resolves.toEqual(
      content,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("clears a failed character load so retry uses a fresh request", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(
        jsonResponse({ strokes: ["M 0 0"], medians: [[[234, 510]]] }),
      );

    await expect(
      loadCharacter("你", fetcher as unknown as typeof fetch),
    ).rejects.toThrow("network down");
    await expect(
      loadCharacter("你", fetcher as unknown as typeof fetch),
    ).resolves.toEqual({
      strokes: ["M 0 0"],
      medians: [[{ x: 234, y: 510 }]],
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
