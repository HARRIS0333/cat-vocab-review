import { useLayoutEffect, useRef, useState } from "react";
import {
  createSpeechService,
  type SpeechService,
} from "../audio/speech";

type SpeechButtonProps = {
  text: string;
  speechService?: SpeechService;
  label?: string;
  initialFailure?: boolean;
};

const failureMessage = "此设备暂时无法播放读音";

export function SpeechButton({
  text,
  speechService,
  label,
  initialFailure = false,
}: SpeechButtonProps) {
  const [fallbackService] = useState(createSpeechService);
  const service = speechService ?? fallbackService;
  const [failed, setFailed] = useState(initialFailure);
  const [pending, setPending] = useState(false);
  const requestId = useRef(0);
  const ownsPlayback = useRef(false);

  useLayoutEffect(() => {
    setPending(false);
    setFailed(initialFailure);

    return () => {
      requestId.current += 1;
      if (ownsPlayback.current) {
        ownsPlayback.current = false;
        service.cancel();
      }
    };
    // initialFailure is synchronized separately so an automatic speech result
    // cannot cancel a manual replay that this button now owns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, text]);

  useLayoutEffect(() => {
    if (!ownsPlayback.current) setFailed(initialFailure);
  }, [initialFailure]);

  async function handleSpeak() {
    if (pending || ownsPlayback.current) return;
    const currentRequest = ++requestId.current;
    ownsPlayback.current = true;
    setPending(true);
    setFailed(false);

    let result: Awaited<ReturnType<SpeechService["speak"]>>;
    try {
      result = await service.speak(text);
    } catch {
      result = "error";
    }

    if (currentRequest !== requestId.current) return;
    ownsPlayback.current = false;
    setPending(false);
    setFailed(result !== "spoken");
  }

  return (
    <span className="speech-control">
      <button
        className="button button-secondary speech-button"
        type="button"
        aria-label={failed ? "再试一次" : label}
        disabled={pending}
        onClick={handleSpeak}
      >
        <span aria-hidden="true">🔊</span>
        {pending ? "正在播放…" : failed ? "再试一次" : "播放读音"}
      </button>
      {failed ? (
        <span className="speech-status" role="status">
          {failureMessage}
        </span>
      ) : null}
    </span>
  );
}
