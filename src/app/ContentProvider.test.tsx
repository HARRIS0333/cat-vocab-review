import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLoadCacheForTests } from "../content/load-content";
import { makeContentFixture } from "../test/fixtures";
import { ContentProvider, useContent } from "./ContentProvider";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function ContentProbe() {
  const { content } = useContent();
  return <p>已加载 {content.groups[0]?.title}</p>;
}

describe("ContentProvider", () => {
  beforeEach(() => {
    clearLoadCacheForTests();
    vi.unstubAllGlobals();
  });

  it("renders a loading status before exposing successful content", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    render(
      <ContentProvider>
        <ContentProbe />
      </ContentProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("正在加载课程内容");
    resolveFetch?.(jsonResponse(makeContentFixture()));
    expect(await screen.findByText("已加载 1 观潮")).toBeInTheDocument();
  });

  it("shows the real error and retries with a fresh request", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(makeContentFixture()));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();

    render(
      <ContentProvider>
        <ContentProbe />
      </ContentProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "内容加载失败（503）",
    );
    await user.click(screen.getByRole("button", { name: "重试" }));

    expect(await screen.findByText("已加载 1 观潮")).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects useContent outside the provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<ContentProbe />)).toThrow(
      "useContent 必须在 ContentProvider 内使用",
    );

    consoleError.mockRestore();
  });
});
