// Stage 26 · Mầm Thú: every sproutling draws, and every element's befriending game starts (the pot game is played through).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Befriend } from "@/features/arena/sprout/Befriend";
import { Creature } from "@/features/arena/sprout/Creature";
import { SPECIES_IDS, type SpeciesId } from "@/features/arena/sprout/sprout";

describe("Mầm Thú screens", () => {
  it("draws all 17 sproutlings", () => {
    const { container } = render(
      <div>
        {SPECIES_IDS.map((s) => (
          <Creature key={s} species={s} size={40} title={s} />
        ))}
      </div>,
    );
    expect(container.querySelectorAll("svg")).toHaveLength(17);
    for (const svg of container.querySelectorAll("svg")) expect(svg.querySelectorAll("path, circle, ellipse, rect").length).toBeGreaterThan(3);
  });

  const games: [SpeciesId, RegExp][] = [
    ["giot", /ripple before it fades/],
    ["mamTre", /grow the shoot/],
    ["thanHong", /cosy zone/],
    ["gom", /drop each pot/],
    ["chuongNho", /ring meets the bell/],
  ];
  it.each(games)("%s: the befriending game starts", (species, text) => {
    render(<Befriend species={species} bonus={0.1} onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Ready" }));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("the pot game ends after five pots with a score from 0 to 1", async () => {
    const onDone = vi.fn();
    render(<Befriend species="gom" bonus={0} onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Ready" }));
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(window, { code: "Space" });
      await new Promise((r) => setTimeout(r, 60));
    }
    await waitFor(() => expect(onDone).toHaveBeenCalled(), { timeout: 2000 });
    const score = onDone.mock.calls[0][0];
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
