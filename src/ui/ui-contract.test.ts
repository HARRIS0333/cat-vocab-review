import { describe, expect, it } from "vitest";
import tokens from "./tokens.css?raw";
import ui from "./ui.css?raw";

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]+)\\}`));
  if (!match) throw new Error(`Missing CSS rule: ${selector}`);
  return match[1] ?? "";
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("UI CSS contract", () => {
  it("gives generic interactive elements a real 44 by 44 CSS pixel target", () => {
    const genericTarget = rule(ui, 'button,\na,\n[role="button"]');

    expect(genericTarget).toMatch(/display:\s*inline-flex/);
    expect(genericTarget).toMatch(/box-sizing:\s*border-box/);
    expect(genericTarget).toMatch(/min-width:\s*44px/);
    expect(genericTarget).toMatch(/min-height:\s*44px/);
    expect(genericTarget).toMatch(/max-width:\s*100%/);
  });

  it("keeps primary button text at WCAG AA contrast", () => {
    const actionColor = tokens.match(/--color-action-rose:\s*(#[0-9a-f]{6})/i)?.[1];
    const primary = rule(ui, ".button-primary");

    expect(actionColor).toBeDefined();
    expect(primary).toMatch(/background:\s*var\(--color-action-rose\)/);
    expect(contrastRatio(actionColor!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps PWA notices in document flow so they cannot cover the writing board", () => {
    const notices = rule(ui, ".pwa-notices");
    const noticeCard = rule(ui, ".pwa-status,\n.pwa-update");

    expect(notices).toMatch(/display:\s*grid/);
    expect(notices).toMatch(/gap:\s*10px/);
    expect(noticeCard).not.toMatch(/position:\s*(?:fixed|absolute|sticky)/);
    expect(noticeCard).toMatch(/width:\s*100%/);
  });

  it("limits the hint and celebration mascot motion to two iterations", () => {
    const mascotMotion = rule(ui, ".mascot-hint,\n.mascot-celebrate");
    const iterations = mascotMotion.match(/animation-iteration-count:\s*(\d+)/)?.[1];

    expect(iterations).toBeDefined();
    expect(Number(iterations)).toBeGreaterThanOrEqual(1);
    expect(Number(iterations)).toBeLessThanOrEqual(2);
  });
});
