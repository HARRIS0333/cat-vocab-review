import { useState } from "react";
import type { ContentFile } from "../../content/types";
import { getProgressOverview } from "../../progress/progress-store";
import { useProgress } from "../../progress/ProgressProvider";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { LessonList } from "./LessonList";

type HomePageProps = {
  content: ContentFile;
};

function titleForRecentGroup(title: string): string {
  return title.trim() || "未命名课目";
}

export function HomePage({ content }: HomePageProps) {
  const { snapshot, store } = useProgress();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearFeedback, setClearFeedback] = useState("");
  const recentGroup = snapshot.state.recent
    ? content.groups.find((group) => group.id === snapshot.state.recent?.groupId)
    : undefined;
  const recentMode = snapshot.state.recent?.mode;
  const modeLabel = recentMode === "write" ? "书写" : "认读";
  const overview = getProgressOverview(content.groups, snapshot.state);

  function confirmClearProgress() {
    store.clearAll();
    setConfirmClearOpen(false);
    setClearFeedback("学习进度已清除");
  }

  return (
    <section className="home-page" aria-labelledby="home-heading">
      <header className="page-heading">
        <p className="eyebrow">四年级上册 · 生字复习</p>
        <h2 id="home-heading">选择课目</h2>
        <p>按单元依次复习识字表和写字表。</p>
      </header>
      <section className="resume-card" aria-labelledby="resume-heading">
        <h3 id="resume-heading">继续最近练习</h3>
        {recentGroup && recentMode ? (
          <a
            className="resume-link lesson-link"
            href={`#/lesson/${encodeURIComponent(recentGroup.id)}/${recentMode}`}
          >
            继续 {titleForRecentGroup(recentGroup.title)} · {modeLabel}
          </a>
        ) : (
          <p className="resume-empty">从一课开始吧</p>
        )}
        <p className="progress-overview" aria-label="本地进度概览">
          <span>已掌握 {overview.mastered}</span>
          <span>待复习 {overview.review}</span>
        </p>
        <div className="progress-actions">
          <Button
            variant="ghost"
            className="progress-clear-trigger"
            onClick={() => {
              setClearFeedback("");
              setConfirmClearOpen(true);
            }}
          >
            清除学习进度
          </Button>
        </div>
        {clearFeedback ? (
          <p className="progress-clear-feedback" role="status" aria-live="polite">
            {clearFeedback}
          </p>
        ) : null}
        {snapshot.warning ? (
          <p className="progress-warning" role="status" aria-live="polite">
            {snapshot.warning}
          </p>
        ) : null}
      </section>
      <LessonList groups={content.groups} className="home-lesson-list" />
      <ConfirmDialog
        open={confirmClearOpen}
        title="清除全部学习进度？"
        description="清除后无法恢复，已掌握、待复习和最近练习记录都会归零。"
        confirmLabel="清除进度"
        destructive
        onConfirm={confirmClearProgress}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </section>
  );
}
