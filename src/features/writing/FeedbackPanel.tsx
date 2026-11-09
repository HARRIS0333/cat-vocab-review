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
  onNext: () => void;
};

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
  onNext,
}: FeedbackPanelProps) {
  const reasons = [...new Set(evaluation.reasons)];

  if (evaluation.verdict === "correct") {
    return (
      <section className="writing-feedback writing-feedback--correct" aria-live="polite">
        <span className="writing-feedback-icon" aria-hidden="true">
          ✓
        </span>
        <h3>写对了！</h3>
        <p>小桃猫看到啦，这一笔一画都很认真。</p>
        <Button onClick={onNext}>下一字</Button>
      </section>
    );
  }

  if (evaluation.verdict === "unclear") {
    return (
      <section className="writing-feedback writing-feedback--unclear" aria-live="polite">
        <h3>再写清楚一点</h3>
        <p>小桃猫没看清，请再写清楚一点</p>
        <Button onClick={onRetry}>再写一次</Button>
      </section>
    );
  }

  return (
    <section className="writing-feedback writing-feedback--incorrect">
      <div className="writing-feedback-copy" aria-live="polite">
        <h3>这次还差一点</h3>
        <ul className="writing-feedback-reasons">
          {reasons.map((reason) => (
            <li key={reason}>{reasonLabel(reason)}</li>
          ))}
        </ul>
      </div>
      <StrokePlayer
        key={`${char}:${attempt}`}
        char={char}
        characterData={characterData}
        autoPlay
      />
      <div className="writing-feedback-actions">
        <Button onClick={onRetry}>再写一次</Button>
        <Button variant="secondary" onClick={onSkip}>
          先跳过
        </Button>
      </div>
    </section>
  );
}
