import { useEffect, useRef, useState } from "react";
import { navigate } from "../../app/hash-router";
import { getWritingItems, resolveWritingSource } from "../../content/sources";
import type { ContentGroup, PracticeItem, WritingSource } from "../../content/types";
import { loadCharacter } from "../../content/load-content";
import {
  evaluateCharacter,
  type Evaluation,
} from "../../handwriting/character-evaluator";
import type {
  CharacterFileData,
  InputStroke,
} from "../../handwriting/types";
import type { ProgressStore } from "../../progress/progress-store";
import { Mascot } from "../../ui/Mascot";
import { ModeSwitch } from "../../ui/ModeSwitch";
import { Button } from "../../ui/Button";
import { createSessionSummary, saveSessionSummary } from "../session/session-summary";
import { takeRetryQueue } from "../session/retry-queue";
import { FeedbackPanel } from "./FeedbackPanel";
import { SourceSelector } from "./SourceSelector";
import { WritingBoard } from "./WritingBoard";
import {
  createWritingSession,
  writingSessionReducer,
} from "./writing-session";
import "./writing.css";

type WritingPageProps = {
  group: ContentGroup;
  retry: boolean;
  store: ProgressStore;
  loadCharacterData?: typeof loadCharacter;
  evaluate?: typeof evaluateCharacter;
};

type InitialWriting = {
  source: WritingSource;
  notice?: string;
  session: ReturnType<typeof createWritingSession>;
};

type LoadState =
  | { char: string; status: "loading" }
  | { char: string; status: "loaded"; data: CharacterFileData }
  | { char: string; status: "failed" };

function resolveInitialWriting(
  group: ContentGroup,
  retry: boolean,
  store: ProgressStore,
): InitialWriting {
  if (retry) {
    const queuedIds = new Set(takeRetryQueue(group.id, "write"));
    if (queuedIds.size > 0) {
      const retryItems: PracticeItem[] = getWritingItems(group, "both").filter(
        (item) => queuedIds.has(item.id),
      );
      if (retryItems.length > 0) {
        return {
          source: "both",
          notice: "正在重练本次错字",
          session: createWritingSession(retryItems),
        };
      }
    }
  }

  const defaultSource = store.getSnapshot().state.settings.defaultWritingSource;
  const resolved = resolveWritingSource(group, defaultSource);
  return {
    source: resolved.source,
    notice: resolved.notice,
    session: createWritingSession(resolved.items),
  };
}

function displayUnit(unit: string): string {
  return unit.trim() || "未分单元";
}

function displayTitle(title: string): string {
  return title.trim() || "未命名课目";
}

export function WritingPage({
  group,
  retry,
  store,
  loadCharacterData = loadCharacter,
  evaluate = evaluateCharacter,
}: WritingPageProps) {
  const [initial] = useState(() => resolveInitialWriting(group, retry, store));
  const [source, setSource] = useState(initial.source);
  const [sourceNotice, setSourceNotice] = useState(initial.notice);
  const [state, setState] = useState(initial.session);
  const [draftStrokes, setDraftStrokes] = useState<InputStroke[]>([]);
  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const completedHandled = useRef(false);
  const submissionLocked = useRef(false);
  const currentItem = state.currentItem;
  const currentChar = currentItem?.char;
  const characterData =
    currentChar &&
    loadState?.char === currentChar &&
    loadState.status === "loaded"
      ? loadState.data
      : undefined;
  const loadFailed =
    Boolean(currentChar) &&
    loadState?.char === currentChar &&
    loadState?.status === "failed";
  const isLoading =
    Boolean(currentChar) && !characterData && !loadFailed;

  useEffect(() => {
    if (!currentChar) {
      setLoadState(null);
      return;
    }

    let active = true;
    setLoadState({ char: currentChar, status: "loading" });

    void Promise.resolve()
      .then(() => loadCharacterData(currentChar))
      .then(
        (data) => {
          if (active) {
            setLoadState({ char: currentChar, status: "loaded", data });
          }
        },
        () => {
          if (active) {
            setLoadState({ char: currentChar, status: "failed" });
          }
        },
      );

    return () => {
      active = false;
    };
  }, [currentChar, loadCharacterData, loadVersion]);

  useEffect(() => {
    if (state.phase === "answering") submissionLocked.current = false;
  }, [currentItem?.id, state.phase]);

  useEffect(() => {
    if (state.phase !== "correct" || !currentItem) return;
    const itemId = currentItem.id;
    const timer = window.setTimeout(() => {
      setState((current) =>
        current.phase === "correct" && current.currentItem?.id === itemId
          ? writingSessionReducer(current, { type: "next" })
          : current,
      );
    }, 800);

    return () => window.clearTimeout(timer);
  }, [state.phase, currentItem?.id]);

  useEffect(() => {
    if (state.results.length === 0) return;

    saveSessionSummary(createSessionSummary(group.id, "write", state.results));
    if (state.completed && !completedHandled.current) {
      completedHandled.current = true;
      navigate({ name: "summary", groupId: group.id, mode: "write" });
    }
  }, [group.id, state.completed, state.results]);

  function changeSource(nextSource: WritingSource) {
    const resolved = resolveWritingSource(group, nextSource);
    setSource(resolved.source);
    setSourceNotice(resolved.notice);
    setState(createWritingSession(resolved.items));
    setDraftStrokes([]);
    store.setDefaultWritingSource(nextSource);
  }

  function handleStrokesChange(strokes: InputStroke[]) {
    if (state.phase === "answering") setDraftStrokes(strokes);
  }

  function handleSubmit(strokes: InputStroke[]) {
    if (!currentItem || !characterData || state.phase !== "answering") return;
    if (strokes.length === 0 || submissionLocked.current) return;

    submissionLocked.current = true;
    setDraftStrokes(strokes);
    setState((current) =>
      writingSessionReducer(current, { type: "submit", strokes }),
    );

    const evaluation: Evaluation = evaluate(strokes, characterData);
    setState((current) =>
      writingSessionReducer(current, { type: "evaluated", evaluation }),
    );

    if (evaluation.verdict === "correct") {
      store.recordWriting(currentItem.id, "correct");
    } else if (evaluation.verdict === "incorrect") {
      store.recordWriting(currentItem.id, "wrong");
    }
    store.setRecent(group.id, "write");
  }

  function handleRetry() {
    setDraftStrokes([]);
    setState((current) => writingSessionReducer(current, { type: "retry" }));
  }

  function handleNext() {
    setDraftStrokes([]);
    setState((current) => writingSessionReducer(current, { type: "next" }));
  }

  function handleSkipWrong() {
    if (!currentItem) return;
    store.recordWriting(currentItem.id, "skipped");
    setDraftStrokes([]);
    setState((current) => writingSessionReducer(current, { type: "skip" }));
  }

  function handleSkipUnavailable() {
    if (!currentItem) return;
    store.recordWriting(currentItem.id, "skipped");
    setDraftStrokes([]);
    setState((current) => writingSessionReducer(current, { type: "load-failed" }));
  }

  function reloadCharacter() {
    setLoadState(null);
    setLoadVersion((current) => current + 1);
  }

  return (
    <section
      className="practice-page writing-page"
      aria-labelledby="practice-heading"
    >
      <a className="text-link" href="#/">
        返回首页
      </a>
      <p className="eyebrow">{displayUnit(group.unit)}</p>
      <h2 id="practice-heading">{displayTitle(group.title)}</h2>
      <ModeSwitch groupId={group.id} mode="write" retry={retry} />
      <SourceSelector
        group={group}
        value={source}
        notice={sourceNotice}
        onChange={changeSource}
      />

      <div className="writing-stage">
        {state.items.length === 0 ? (
          <p className="placeholder-note">本课暂时没有书写内容</p>
        ) : currentItem ? (
          <>
            <div className="writing-progress">
              <p>
                第 {state.index + 1} / {state.items.length} 题
              </p>
              <progress
                aria-label="书写练习进度"
                max={state.items.length}
                value={state.index}
              />
            </div>

            <div className="writing-prompt">
              <Mascot mood="write" />
              <p className="writing-pinyin">{currentItem.pinyin}</p>
              {currentItem.polyphone ? (
                <span className="writing-polyphone">多音字</span>
              ) : null}
            </div>

            {isLoading ? (
              <p className="status-message" role="status" aria-live="polite">
                正在准备这个字的笔顺数据…
              </p>
            ) : loadFailed ? (
              <section className="writing-load-error" aria-labelledby="load-error-heading">
                <h3 id="load-error-heading">这个字的笔顺数据暂时无法加载</h3>
                <p>可以先重新加载，或者跳过这个字，稍后再复习。</p>
                <div className="writing-load-error-actions">
                  <Button onClick={reloadCharacter}>重新加载</Button>
                  <Button variant="secondary" onClick={handleSkipUnavailable}>
                    先跳过
                  </Button>
                </div>
              </section>
            ) : characterData ? (
              <>
                <WritingBoard
                  strokes={draftStrokes}
                  disabled={state.phase !== "answering"}
                  onChange={handleStrokesChange}
                  onSubmit={handleSubmit}
                />
                {state.phase === "evaluating" ? (
                  <p className="status-message" role="status" aria-live="polite">
                    正在检查这次书写…
                  </p>
                ) : null}
                {state.evaluation ? (
                  <FeedbackPanel
                    evaluation={state.evaluation}
                    char={currentItem.char}
                    characterData={characterData}
                    attempt={state.attempt}
                    onRetry={handleRetry}
                    onSkip={handleSkipWrong}
                    onNext={handleNext}
                  />
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <p className="status-message" role="status" aria-live="polite">
            正在整理练习结果…
          </p>
        )}
      </div>
    </section>
  );
}
