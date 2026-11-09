import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SpeechButton } from "./SpeechButton";

it("speaks on click and shows a retry message on failure", async () => {
  const speechService = {
    speak: vi.fn().mockResolvedValue("error"),
    cancel: vi.fn(),
  };
  render(<SpeechButton text="单薄" speechService={speechService} />);

  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));

  expect(speechService.speak).toHaveBeenCalledWith("单薄");
  expect(await screen.findByRole("status")).toHaveTextContent(
    "此设备暂时无法播放读音",
  );
  expect(screen.getByText("再试一次")).toBeInTheDocument();
});

it("clears a prior error after speech succeeds", async () => {
  const speechService = {
    speak: vi
      .fn()
      .mockResolvedValueOnce("unavailable")
      .mockResolvedValueOnce("spoken"),
    cancel: vi.fn(),
  };
  render(
    <SpeechButton
      text="屹立"
      label="播放“屹立”的读音"
      speechService={speechService}
    />,
  );

  await userEvent.click(
    screen.getByRole("button", { name: "播放“屹立”的读音" }),
  );
  expect(await screen.findByRole("status")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /再试一次/ }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByText("播放读音")).toBeInTheDocument();
});

it("clears a prior error when the text changes", async () => {
  const speechService = {
    speak: vi.fn().mockResolvedValue("error"),
    cancel: vi.fn(),
  };
  const { rerender } = render(
    <SpeechButton text="单薄" speechService={speechService} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));
  expect(await screen.findByRole("status")).toBeInTheDocument();

  rerender(<SpeechButton text="薄雾" speechService={speechService} />);

  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "播放读音" })).toBeEnabled();
});

it("clears a prior error when the speech service changes", async () => {
  const oldService = {
    speak: vi.fn().mockResolvedValue("error"),
    cancel: vi.fn(),
  };
  const newService = {
    speak: vi.fn().mockResolvedValue("spoken"),
    cancel: vi.fn(),
  };
  const { rerender } = render(
    <SpeechButton text="屹立" speechService={oldService} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));
  expect(await screen.findByRole("status")).toBeInTheDocument();

  rerender(<SpeechButton text="屹立" speechService={newService} />);

  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "播放读音" })).toBeEnabled();
});

it("ignores an old request after the text changes", async () => {
  let resolveOld: ((result: "error") => void) | undefined;
  const speechService = {
    speak: vi.fn(() => new Promise<"error">((resolve) => {
      resolveOld = resolve;
    })),
    cancel: vi.fn(),
  };
  const { rerender } = render(
    <SpeechButton text="单薄" speechService={speechService} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));
  expect(screen.getByRole("button", { name: "正在播放…" })).toBeDisabled();

  rerender(<SpeechButton text="薄雾" speechService={speechService} />);

  expect(speechService.cancel).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "播放读音" })).toBeEnabled();

  await act(async () => resolveOld?.("error"));

  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "播放读音" })).toBeEnabled();
});

it("cancels the previous service and ignores its completion when service changes", async () => {
  let resolveOld: ((result: "spoken") => void) | undefined;
  const oldService = {
    speak: vi.fn(() => new Promise<"spoken">((resolve) => {
      resolveOld = resolve;
    })),
    cancel: vi.fn(),
  };
  const newService = {
    speak: vi.fn().mockResolvedValue("spoken"),
    cancel: vi.fn(),
  };
  const { rerender } = render(
    <SpeechButton text="屹立" speechService={oldService} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));
  rerender(<SpeechButton text="屹立" speechService={newService} />);

  expect(oldService.cancel).toHaveBeenCalled();
  await act(async () => resolveOld?.("spoken"));

  expect(screen.getByRole("button", { name: "播放读音" })).toBeEnabled();
  expect(newService.cancel).not.toHaveBeenCalled();
});

it("turns a rejected speak promise into a retryable failure", async () => {
  const speechService = {
    speak: vi.fn().mockRejectedValue(new Error("speech failed")),
    cancel: vi.fn(),
  };
  render(<SpeechButton text="霎时" speechService={speechService} />);

  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "此设备暂时无法播放读音",
  );
  expect(screen.getByRole("button", { name: "再试一次" })).toBeEnabled();
});

it("cancels active speech when unmounted", async () => {
  const speechService = {
    speak: vi.fn(() => new Promise<"spoken">(() => undefined)),
    cancel: vi.fn(),
  };
  const { unmount } = render(
    <SpeechButton text="观潮" speechService={speechService} />,
  );

  await userEvent.click(screen.getByRole("button", { name: "播放读音" }));
  unmount();

  expect(speechService.cancel).toHaveBeenCalled();
});
