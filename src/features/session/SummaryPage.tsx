import { useState } from "react";
import type { PracticeMode } from "../../app/hash-router";
import { toHash } from "../../app/hash-router";
import type { ProgressStore } from "../../progress/progress-store";
import { Mascot } from "../../ui/Mascot";
import { loadSessionSummary } from "./session-summary";
import { saveRetryQueue } from "./retry-queue";

type SummaryPageProps = {
  group: { id: string; title: string };
  groupId: string;
  mode: PracticeMode;
  store: ProgressStore;
};

export function SummaryPage({ group, groupId, mode }: SummaryPageProps) {
  const [summary] = useState(() => loadSessionSummary(groupId, mode));
  const retryItemIds = summary?.errorItems
    .filter((item) => item.result === "review")
    .map((item) => item.id) ?? [];
  const retryHash = toHash({
    name: "practice",
    groupId,
    mode,
    retry: true,
  });

  if (!summary) {
    return (
      <section className="summary-page" aria-labelledby="summary-heading">
        <p className="eyebrow">练习结果</p>
        <h2 id="summary-heading">本次练习结果</h2>
        <p>没有找到本次练习结果</p>
        <a className="text-link" href="#/">
          返回首页
        </a>
      </section>
    );
  }

  return (
    <section className="summary-page" aria-labelledby="summary-heading">
      <p className="eyebrow">{group.title.trim() || "未命名课目"}</p>
      <h2 id="summary-heading">本次练习结果</h2>
      <Mascot mood="celebrate" />

      <div className="summary-stats" aria-label="本次练习统计">
        <output className="summary-stat" aria-label="本次正确">
          <strong>{summary.successCount}</strong>
          <span aria-hidden="true">本次正确</span>
        </output>
        <output className="summary-stat" aria-label="本次待复习">
          <strong>{summary.reviewCount}</strong>
          <span aria-hidden="true">本次待复习</span>
        </output>
      </div>

      <section aria-labelledby="review-heading">
        <h3 id="review-heading">需要再看一眼的字</h3>
        {summary.errorItems.length > 0 ? (
          <ul className="review-characters" aria-label="待复习字">
            {summary.errorItems.map((item) => (
              <li key={item.id}>
                <span>{item.char}</span>
                <span>{item.pinyin}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>这次全部掌握啦！</p>
        )}
      </section>

      <p className="link-row">
        {retryItemIds.length > 0 ? (
          <a
            className="button button-primary"
            href={retryHash}
            onClick={() => saveRetryQueue(groupId, mode, retryItemIds)}
          >
            再练待复习字
          </a>
        ) : null}
        <a className="text-link" href="#/">
          返回课目
        </a>
      </p>
    </section>
  );
}
