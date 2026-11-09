import type { ContentGroup, WritingSource } from "../../content/types";
import { getWritingSourceOptions } from "../../content/sources";
import { Button } from "../../ui/Button";

type SourceSelectorProps = {
  group: ContentGroup;
  value: WritingSource;
  notice?: string;
  onChange: (source: WritingSource) => void;
};

export function SourceSelector({
  group,
  value,
  notice,
  onChange,
}: SourceSelectorProps) {
  return (
    <fieldset className="writing-source-selector">
      <legend>选择书写范围</legend>
      <div className="writing-source-options">
        {getWritingSourceOptions(group).map((option) => (
          <Button
            key={option.source}
            className="writing-source-option"
            variant={option.source === value ? "primary" : "secondary"}
            disabled={option.disabled}
            aria-pressed={option.source === value}
            onClick={() => onChange(option.source)}
          >
            {option.label} · {option.count} 字
          </Button>
        ))}
      </div>
      {notice ? (
        <p className="writing-source-notice" role="status">
          {notice}
        </p>
      ) : null}
    </fieldset>
  );
}
