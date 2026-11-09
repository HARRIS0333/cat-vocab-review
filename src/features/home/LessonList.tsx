import { Fragment } from "react";
import type { ContentGroup } from "../../content/types";

type LessonListProps = {
  groups: ContentGroup[];
  currentGroupId?: string;
  onNavigate?: () => void;
  variant?: "default" | "compact";
  className?: string;
};

function unitLabel(unit: string): string {
  return unit.trim() || "未分单元";
}

function groupTitle(title: string): string {
  return title.trim() || "未命名课目";
}

export function LessonList({
  groups,
  currentGroupId,
  onNavigate,
  variant = "default",
  className,
}: LessonListProps) {
  const classes = [
    "lesson-list",
    variant === "compact" ? "lesson-list--compact" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ol className={classes} aria-label="课目列表">
      {groups.map((group, index) => {
        const previous = groups[index - 1];
        const unit = unitLabel(group.unit);
        const showUnit = index === 0 || unitLabel(previous?.unit ?? "") !== unit;
        const title = groupTitle(group.title);
        const rawId = group.id.trim() ? group.id : `unnamed-${index + 1}`;

        return (
          <Fragment key={`${group.id}-${index}`}>
            {showUnit ? (
              <li className="unit-heading">
                <h3>{unit}</h3>
              </li>
            ) : null}
            <li className="lesson-item">
              <a
                className="lesson-link"
                href={`#/lesson/${encodeURIComponent(rawId)}/read`}
                aria-current={group.id === currentGroupId ? "page" : undefined}
                onClick={onNavigate}
              >
                <span className="lesson-title">{title}</span>
                <span className="lesson-count">识字 {group.reading.length}</span>
                <span className="lesson-count">写字 {group.writing.length}</span>
              </a>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
