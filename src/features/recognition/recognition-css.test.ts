import { expect, it } from "vitest";
import css from "./recognition.css?raw";

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]+)\\}`));
  if (!match) throw new Error(`Missing CSS rule: ${selector}`);
  return match[1] ?? "";
}

it("renders recognition characters as large responsive kai-style cards", () => {
  const character = rule(".recognition-char");
  const pinyin = rule(".recognition-pinyin");

  expect(character).toMatch(/font-family:\s*var\(--font-kai\)/);
  expect(character).toMatch(/font-size:\s*clamp\(/);
  expect(pinyin).toMatch(/font-size:\s*clamp\(/);
  expect(css).toMatch(/@media\s*\(max-width:\s*560px\)/);
});
