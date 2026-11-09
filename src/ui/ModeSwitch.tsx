import { toHash, type PracticeMode } from "../app/hash-router";

type ModeSwitchProps = {
  groupId: string;
  mode: PracticeMode;
  retry?: boolean;
};

export function ModeSwitch({ groupId, mode, retry = false }: ModeSwitchProps) {
  const modes: Array<{ id: PracticeMode; label: string }> = [
    { id: "read", label: "认读" },
    { id: "write", label: "书写" },
  ];

  return (
    <nav className="mode-switch" aria-label="练习模式">
      {modes.map((candidate) => (
        <a
          key={candidate.id}
          className="mode-switch-link"
          href={toHash({
            name: "practice",
            groupId,
            mode: candidate.id,
            retry,
          })}
          aria-current={candidate.id === mode ? "page" : undefined}
        >
          {candidate.label}
        </a>
      ))}
    </nav>
  );
}
