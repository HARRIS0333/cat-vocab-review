import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  ErrorReason,
  Evaluation,
} from "../../handwriting/character-evaluator";
import type { CharacterFileData } from "../../handwriting/types";
import { Button } from "../../ui/Button";
import { StrokePlayer } from "../../ui/StrokePlayer";

const reasonLabels: Record<ErrorReason, string> = {
  stroke_count: "笔画数量不对",
  stroke_shape: "字形或笔画位置不太准确",
  stroke_order: "笔画顺序不对",
  stroke_direction: "有一笔方向反了",
  ink_quality: "再写清楚一些",
};

type FeedbackPanelProps = {
  evaluation: Evaluation;
  char: string;
  characterData: CharacterFileData;
  attempt: number;
  onRetry: () => void;
  onSkip: () => void;
};

function focusableElements(dialog: HTMLDialogElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true");
}

export function reasonLabel(reason: ErrorReason): string {
  return reasonLabels[reason];
}

export function FeedbackPanel({
  evaluation,
  char,
  characterData,
  attempt,
  onRetry,
  onSkip,
}: FeedbackPanelProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasons = [...new Set(evaluation.reasons)];
  const [dialogReady, setDialogReady] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!dialog) return;

    try {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } catch {
      dialog.setAttribute("open", "");
    }
    setDialogReady(true);

    const firstAction = dialog.querySelector<HTMLButtonElement>("button");
    if (firstAction) {
      firstAction.focus();
    } else {
      dialog.focus();
    }

    return () => {
      try {
        if (typeof dialog.close === "function" && dialog.open) {
          dialog.close();
        } else {
          dialog.removeAttribute("open");
        }
      } catch {
        dialog.removeAttribute("open");
      }
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = focusableElements(dialogRef.current);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={`writing-feedback-dialog writing-feedback-dialog--${evaluation.verdict}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="writing-feedback-dialog__body">
        {evaluation.verdict === "correct" ? (
          <>
            <span className="writing-feedback-icon" aria-hidden="true">
              ✓
            </span>
            <h3 id={titleId}>写对了！</h3>
            <p>小桃猫看到啦，这一笔一画都很认真。</p>
          </>
        ) : evaluation.verdict === "unclear" ? (
          <>
            <h3 id={titleId}>再写清楚一点</h3>
            <p>小桃猫没看清，请再写清楚一点</p>
            <div className="writing-feedback-actions writing-feedback-actions--single">
              <Button onClick={onRetry}>再写一次</Button>
            </div>
          </>
        ) : (
          <>
            <div className="writing-feedback-copy">
              <h3 id={titleId}>这次还差一点</h3>
              <ul className="writing-feedback-reasons">
                {reasons.map((reason) => (
                  <li key={reason}>{reasonLabel(reason)}</li>
                ))}
              </ul>
            </div>
            {dialogReady ? (
              <StrokePlayer
                key={`${char}:${attempt}`}
                char={char}
                characterData={characterData}
                autoPlay
              />
            ) : null}
            <div className="writing-feedback-actions">
              <Button onClick={onRetry}>再写一次</Button>
              <Button variant="secondary" onClick={onSkip}>
                先跳过
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
