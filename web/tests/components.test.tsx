import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TrackCard } from "@/features/ambient/TrackCard";
import { TRACKS } from "@/features/ambient/tracks";

describe("SegmentedControl", () => {
  it("marks the selected option and reports clicks", async () => {
    const onChange = vi.fn();
    const options = [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta" },
    ] as const;
    render(<SegmentedControl label="Pick" options={options} value="a" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("TrackCard", () => {
  it("is a toggle button named after the track", async () => {
    const onToggle = vi.fn();
    render(<TrackCard track={TRACKS[0]} active={false} onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: /Rain/ });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
