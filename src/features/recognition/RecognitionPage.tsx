import { useEffect, useRef, useState } from "react";
import type { ContentGroup } from "../../content/types";
import { createSpeechService, type SpeechService } from "../../audio/speech";
import type { ProgressStore } from "../../progress/progress-store";
import { navigate } from "../../app/hash-router";
import { Mascot } from "../../ui/Mascot";
import { ModeSwitch } from "../../ui/ModeSwitch";
import { SpeechButton } from "../../ui/SpeechButton";
import { saveRetryQueue, takeRetryQueue } from "../session/retry-queue";
import { createSessionSummary, saveSessionSummary } from "../session/session-summary";
import {
  createRecognitionState,
  recognitionReducer,
  type RecognitionStatus,
} from "./recognition-session";
import "./recognition.css";

type RecognitionPageProps = {
  group: ContentGroup;
  retry: boolean;
  store: ProgressStore;
  speechService?: SpeechService;
};

function resolveItems(group: ContentGroup, retry: boolean) {
  if (!retry) return group.reading;

  const queuedIds = new Set(takeRetryQueue(group.id, "read"));
  if (queuedIds.size === 0) return group.reading;

  const queuedItems = group.reading.filter((item) => queuedIds.has(item.id));
  return queuedItems.length > 0 ? queuedItems : group.reading;
}

export function RecognitionPage({
  group,
  retry,
  store,
  speechService,
}: RecognitionPageProps) {
  const [initialItems] = useState(() => resolveItems(group, retry));
  const [state, setState] = useState(() => createRecognitionState(initialItems));
  const [fallbackSpeechService] = useState(createSpeechService);
  const service = speechService ?? fallbackSpeechService;
  const completedHandled = useRef(false);
  const [autoSpeechFailure, setAutoSpeechFailure] = useState(false);
  const speechRequestId = useRef(0);
  const autoSpeechActive = useRef(false);

  useEffect(() => {
    return () => {
      speechRequestId.current += 1;
      if (autoSpeechActive.current) {
        autoSpeechActive.current = false;
        service.cancel();
      }
    };
  }, [service]);

  useEffect(() => {
    if (
      !state.completed ||
      state.results.length === 0 ||
      completedHandled.current
    ) {
      return;
    }

    completedHandled.current = true;
    saveSessionSummary(
      createSessionSummary(
        group.id,
        "read",
        state.results.map((result) => ({
          id: result.id,
          char: result.char,
          pinyin: result.pinyin,
          result: result.status === "known" ? "correct" : "review",
          hadError: result.status === "review",
        })),
      ),
    );
    navigate({ name: "summary", groupId: group.id, mode: "read" });
  }, [group.id, state.completed, state.results]);

  const currentItem = state.currentItem;

  function playSpeech(text: string) {
    const request = ++speechRequestId.current;
    autoSpeechActive.current = true;
    setAutoSpeechFailure(false);

    const fail = () => {
      if (request !== speechRequestId.current) return;
      autoSpeechActive.current = false;
      setAutoSpeechFailure(true);
    };

    let playback: Promise<"spoken" | "error" | "unavailable">;
    try {
      playback = service.speak(text);
    } catch {
      fail();
      return;
    }

    void playback.then((result) => {
      if (request !== speechRequestId.current) return;
      autoSpeechActive.current = false;
      setAutoSpeechFailure(result !== "spoken");
    }, fail);
  }

  function revealAndSpeak() {
    if (state.revealed || !currentItem) return;
    const speechText = currentItem.speechText ?? currentItem.char;
    setState((current) => recognitionReducer(current, { type: "reveal" }));
    playSpeech(speechText);
  }

  function answer(status: RecognitionStatus) {
    if (!currentItem || !state.revealed) return;
    speechRequestId.current += 1;
    if (autoSpeechActive.current) {
      autoSpeechActive.current = false;
      service.cancel();
    }
    setAutoSpeechFailure(false);
    store.recordRecognition(currentItem.id, status);
    store.setRecent(group.id, "read");
    setState((current) => recognitionReducer(current, { type: "answer", status }));
  }

  if (state.items.length === 0) {
    return (
      <section className="practice-page recognition-page" aria-labelledby="practice-heading">
        <a className="text-link" href="#/">
          返回首页
        </a>
        <p className="eyebrow">{group.unit.trim() || "未分单元"}</p>
        <h2 id="practice-heading">{group.title.trim() || "未命名课目"}</h2>
        <p className="placeholder-note">本课暂时没有认读内容</p>
      </section>
    );
  }

  return (
    <section className="practice-page recognition-page" aria-labelledby="practice-heading">
      <a className="text-link" href="#/">
        返回首页
      </a>
      <p className="eyebrow">{group.unit.trim() || "未分单元"}</p>
      <h2 id="practice-heading">{group.title.trim() || "未命名课目"}</h2>
      <ModeSwitch groupId={group.id} mode="read" retry={retry} />
      {currentItem ? (
        <>
          <div className="recognition-progress">
            <p>
              第 {state.index + 1} / {state.items.length} 题
            </p>
            <progress
              aria-label="练习进度"
              max={state.items.length}
              value={state.index}
            />
          </div>
          <div className="recognition-stage">
            <Mascot mood="read" label={null} />
            <button
              className="recognition-card"
              type="button"
              aria-label={`显示“${currentItem.char}”的拼音和读音`}
              onClick={revealAndSpeak}
            >
              <span className="recognition-char">{currentItem.char}</span>
              {state.revealed ? (
                <span className="recognition-answer">
                  <span className="recognition-pinyin">{currentItem.pinyin}</span>
                  {currentItem.polyphone ? <span>多音字</span> : null}
                </span>
              ) : null}
            </button>
            {state.revealed ? (
              <SpeechButton
                text={currentItem.speechText ?? currentItem.char}
                speechService={service}
                initialFailure={autoSpeechFailure}
              />
            ) : null}
          </div>
          <div className="recognition-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={!state.revealed}
              onClick={() => answer("review")}
            >
              还不熟
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={!state.revealed}
              onClick={() => answer("known")}
            >
              认识
            </button>
          </div>
        </>
      ) : (
        <p className="status-message" role="status" aria-live="polite">
          正在整理练习结果…
        </p>
      )}
    </section>
  );
}
