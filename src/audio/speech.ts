export type SpeechResult = "spoken" | "error" | "unavailable";

export type SpeechService = {
  speak(text: string): Promise<SpeechResult>;
  cancel(): void;
};

export type SpeechServiceOptions = {
  synthesis?: SpeechSynthesis;
  Utterance?: typeof SpeechSynthesisUtterance;
};

function resolveVoice(synthesis: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  try {
    return synthesis
      .getVoices()
      .find((voice) => voice.lang === "zh-CN" || voice.lang === "zh_CN");
  } catch {
    return undefined;
  }
}

export function createSpeechService(
  options: SpeechServiceOptions = {},
): SpeechService {
  const synthesis = Object.hasOwn(options, "synthesis")
    ? options.synthesis
    : globalThis.speechSynthesis;
  const Utterance = Object.hasOwn(options, "Utterance")
    ? options.Utterance
    : globalThis.SpeechSynthesisUtterance;

  let settleActive: ((result: SpeechResult) => void) | null = null;

  function safelyCancel(): boolean {
    if (!synthesis || typeof synthesis.cancel !== "function") {
      return true;
    }

    try {
      synthesis.cancel();
      return true;
    } catch {
      return false;
    }
  }

  return {
    async speak(text) {
      if (
        !synthesis ||
        !Utterance ||
        typeof synthesis.speak !== "function" ||
        typeof synthesis.cancel !== "function"
      ) {
        return "unavailable";
      }

      const previous = settleActive;
      settleActive = null;
      previous?.("error");

      if (!safelyCancel()) {
        return "error";
      }

      let utterance: SpeechSynthesisUtterance;
      try {
        utterance = new Utterance(text);
        utterance.text = text;
        utterance.lang = "zh-CN";
        utterance.rate = 0.75;
        utterance.voice = resolveVoice(synthesis) ?? null;
      } catch {
        return "error";
      }

      return new Promise<SpeechResult>((resolve) => {
        let settled = false;
        const settle = (result: SpeechResult) => {
          if (settled) return;
          settled = true;
          if (settleActive === settle) settleActive = null;
          resolve(result);
        };

        settleActive = settle;
        utterance.onend = () => settle("spoken");
        utterance.onerror = () => settle("error");

        try {
          synthesis.speak(utterance);
        } catch {
          settle("error");
        }
      });
    },

    cancel() {
      const active = settleActive;
      settleActive = null;
      active?.("error");
      safelyCancel();
    },
  };
}
