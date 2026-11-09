import { describe, expect, it, vi } from "vitest";
import { createSpeechService } from "./speech";

class FakeUtterance {
  lang = "";
  rate = 1;
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  onend: SpeechSynthesisUtterance["onend"] = null;
  onerror: SpeechSynthesisUtterance["onerror"] = null;

  constructor(text: string) {
    this.text = text;
  }
}

const Utterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;

function makeSynthesis(
  overrides: Partial<SpeechSynthesis> = {},
): SpeechSynthesis {
  return {
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: vi.fn(() => []),
    ...overrides,
  } as unknown as SpeechSynthesis;
}

describe("speech service", () => {
  it("cancels previous speech and uses slow zh-CN playback", async () => {
    const cancel = vi.fn();
    const speak = vi.fn((utterance: SpeechSynthesisUtterance) => {
      queueMicrotask(() =>
        utterance.onend?.(new Event("end") as SpeechSynthesisEvent),
      );
    });
    const service = createSpeechService({
      synthesis: makeSynthesis({ cancel, speak }),
      Utterance,
    });

    await expect(service.speak("单薄")).resolves.toBe("spoken");

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]?.[0]).toMatchObject({
      text: "单薄",
      lang: "zh-CN",
      rate: 0.75,
    });
  });

  it("prefers a zh-CN or zh_CN voice when one is available", async () => {
    const zhVoice = { lang: "zh_CN" } as SpeechSynthesisVoice;
    const speak = vi.fn((utterance: SpeechSynthesisUtterance) => {
      queueMicrotask(() =>
        utterance.onend?.(new Event("end") as SpeechSynthesisEvent),
      );
    });
    const service = createSpeechService({
      synthesis: makeSynthesis({
        getVoices: vi.fn(() => [
          { lang: "en-US" } as SpeechSynthesisVoice,
          zhVoice,
        ]),
        speak,
      }),
      Utterance,
    });

    await expect(service.speak("浩")).resolves.toBe("spoken");

    expect(speak.mock.calls[0]?.[0].voice).toBe(zhVoice);
  });

  it("returns error when speech synthesis fails", async () => {
    const service = createSpeechService({
      synthesis: makeSynthesis({
        speak: (utterance: SpeechSynthesisUtterance) => {
          queueMicrotask(() =>
            utterance.onerror?.(new Event("error") as SpeechSynthesisErrorEvent),
          );
        },
      }),
      Utterance,
    });

    await expect(service.speak("浩")).resolves.toBe("error");
  });

  it("returns unavailable when the API is absent", async () => {
    const service = createSpeechService({
      synthesis: undefined,
      Utterance: undefined,
    });

    await expect(service.speak("浩")).resolves.toBe("unavailable");
  });

  it("does not overlap consecutive playback", async () => {
    const utterances: SpeechSynthesisUtterance[] = [];
    const cancel = vi.fn();
    const service = createSpeechService({
      synthesis: makeSynthesis({
        cancel,
        speak: (utterance: SpeechSynthesisUtterance) => {
          utterances.push(utterance);
        },
      }),
      Utterance,
    });

    const first = service.speak("浩");
    const second = service.speak("瀚");

    utterances[0]?.onend?.(new Event("end") as SpeechSynthesisEvent);
    utterances[1]?.onend?.(new Event("end") as SpeechSynthesisEvent);

    await expect(first).resolves.toBe("error");
    await expect(second).resolves.toBe("spoken");
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("resolves error instead of throwing when speak throws synchronously", async () => {
    const service = createSpeechService({
      synthesis: makeSynthesis({
        speak: () => {
          throw new Error("speech blocked");
        },
      }),
      Utterance,
    });

    await expect(service.speak("浩")).resolves.toBe("error");
  });

  it("keeps cancel safe when the API is absent or cancellation throws", async () => {
    const unavailable = createSpeechService({
      synthesis: undefined,
      Utterance: undefined,
    });
    expect(() => unavailable.cancel()).not.toThrow();

    const failing = createSpeechService({
      synthesis: makeSynthesis({
        cancel: () => {
          throw new Error("cancel failed");
        },
      }),
      Utterance,
    });
    expect(() => failing.cancel()).not.toThrow();
  });
});
