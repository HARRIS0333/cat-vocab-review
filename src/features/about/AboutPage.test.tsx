import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { makeContentFixture } from "../../test/fixtures";
import { AboutPage } from "./AboutPage";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("states privacy, textbook source, and full license links", () => {
  render(<AboutPage content={makeContentFixture()} />);
  expect(screen.getByText("笔迹只在本机内存中处理，不会上传或保存")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "国家中小学智慧教育平台" })).toHaveAttribute(
    "href",
    expect.stringContaining("basic.smartedu.cn"),
  );
  expect(screen.getByRole("link", { name: "Hanzi Writer MIT 许可" })).toHaveAttribute(
    "href",
    expect.stringContaining("licenses/HanziWriter-MIT.txt"),
  );
  expect(screen.getByRole("link", { name: "Arphic Public License" })).toHaveAttribute(
    "href",
    expect.stringContaining("licenses/ARPHICPL.txt"),
  );
});

it("identifies the audited textbook edition and official source metadata", () => {
  const content = {
    ...makeContentFixture(),
    edition: "（根据2022年版课程标准修订）义务教育教科书·语文四年级上册",
  };
  render(<AboutPage content={content} />);

  expect(screen.getByText("统编版四年级上册")).toBeInTheDocument();
  expect(screen.getAllByText("（根据2022年版课程标准修订）义务教育教科书·语文四年级上册")).toHaveLength(1);
  expect(screen.queryByText(/四年级上册四年级上册/)).not.toBeInTheDocument();
  expect(screen.getByText(/2022 年课标修订/)).toBeInTheDocument();
  expect(screen.getByText(/2024 年审核/)).toBeInTheDocument();
  expect(screen.getByText(/人民教育出版社/)).toBeInTheDocument();
  expect(screen.getByText(/fixture-content-id/)).toBeInTheDocument();
});

it("discloses offline use, privacy boundaries, and the absence of account sync", () => {
  render(<AboutPage content={makeContentFixture()} />);

  expect(screen.getByText(/无账号、无广告、无统计/)).toBeInTheDocument();
  expect(screen.getByText(/不接入第三方手写识别服务/)).toBeInTheDocument();
  expect(screen.getByText("首次联网后可离线使用")).toBeInTheDocument();
  expect(screen.getByText(/不使用教材扫描图/)).toBeInTheDocument();
  expect(screen.getByText(/不提供账号同步/)).toBeInTheDocument();
});

it("keeps license links under the configured base path", () => {
  vi.stubEnv("BASE_URL", "/cat-vocab/");
  render(<AboutPage content={makeContentFixture()} />);

  expect(screen.getByRole("link", { name: "Hanzi Writer MIT 许可" })).toHaveAttribute(
    "href",
    "/cat-vocab/licenses/HanziWriter-MIT.txt",
  );
  expect(screen.getByRole("link", { name: "Arphic Public License" })).toHaveAttribute(
    "href",
    "/cat-vocab/licenses/ARPHICPL.txt",
  );
});

it("links to the Hanzi Writer project and Make Me a Hanzi data source", () => {
  render(<AboutPage content={makeContentFixture()} />);

  const hanziWriter = screen.getByRole("link", { name: "Hanzi Writer 项目" });
  expect(hanziWriter).toHaveAttribute("href", "https://github.com/chanind/hanzi-writer");
  expect(screen.getByRole("link", { name: "Make Me a Hanzi 字符数据" })).toHaveAttribute(
    "href",
    "https://github.com/skishore/makemeahanzi",
  );

  const newWindowLinks = document.querySelectorAll('a[target="_blank"]');
  expect(newWindowLinks).toHaveLength(5);
  for (const link of newWindowLinks) {
    expect(link).toHaveAccessibleDescription("外部或文档链接将在新窗口打开");
  }
});
