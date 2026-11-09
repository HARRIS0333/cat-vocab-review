export type MascotMood =
  | "wave"
  | "read"
  | "write"
  | "happy"
  | "hint"
  | "confused"
  | "celebrate";

type MascotProps = {
  mood: MascotMood;
  label?: string | null;
  className?: string;
};

const moodLabels: Record<MascotMood, string> = {
  wave: "小桃猫在招手",
  read: "小桃猫在读书",
  write: "小桃猫在写字",
  happy: "小桃猫很开心",
  hint: "小桃猫来给提示",
  confused: "小桃猫有点困惑",
  celebrate: "小桃猫在庆祝",
};

export function Mascot({ mood, label, className }: MascotProps) {
  const decorative = label === null;
  const accessibleLabel = label ?? moodLabels[mood];
  const eyes =
    mood === "confused" ? (
      <>
        <path d="M39 60q5-5 10 0" />
        <path d="M72 58q6 3 11-1" />
      </>
    ) : mood === "happy" || mood === "celebrate" ? (
      <>
        <path d="M37 61q7-8 14 0" />
        <path d="M70 61q7-8 14 0" />
      </>
    ) : (
      <>
        <circle cx="44" cy="60" r="3" />
        <circle cx="77" cy="60" r="3" />
      </>
    );

  return (
    <span
      className={["mascot", `mascot-${mood}`, className]
        .filter(Boolean)
        .join(" ")}
      data-mood={mood}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : accessibleLabel}
      aria-hidden={decorative ? "true" : undefined}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <path
          className="mascot-ear"
          d="M27 45 31 16l24 18M93 45l-4-29-24 18"
        />
        <path
          className="mascot-head"
          d="M25 57c0-24 15-36 35-36s35 12 35 36v14c0 23-15 35-35 35S25 94 25 78Z"
        />
        <path className="mascot-stripe" d="M48 26q12 7 24 0" />
        <path
          className="mascot-bow"
          d="M92 38c-16-13-22 4-11 10-11 10 1 20 12 6l5-8Z"
        />
        <circle className="mascot-bow-knot" cx="94" cy="48" r="5" />
        <g className="mascot-face">{eyes}</g>
        <path
          className="mascot-mouth"
          d={mood === "confused" ? "M53 76q8-5 15 1" : "M53 73q8 10 16 0"}
        />
        <path className="mascot-cheek" d="M31 70q7 3 13 0M77 70q7 3 13 0" />
        <path className="mascot-paw" d="M35 101q14 8 25 2M68 103q12 5 22-3" />
        {mood === "read" ? (
          <path className="mascot-prop" d="M42 91h42v19H42zM63 91v19" />
        ) : null}
        {mood === "write" ? (
          <path className="mascot-prop" d="m48 110 32-19 5 8-32 18Z" />
        ) : null}
        {mood === "hint" ? (
          <path className="mascot-spark" d="m100 67 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
        ) : null}
        {mood === "celebrate" ? (
          <>
            <circle className="mascot-spark" cx="105" cy="32" r="4" />
            <circle className="mascot-spark" cx="17" cy="71" r="3" />
            <path className="mascot-spark" d="m14 31 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" />
          </>
        ) : null}
      </svg>
    </span>
  );
}
