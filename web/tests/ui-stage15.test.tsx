// Stage 15: Nook's own dropdown and dialog work with mouse, keyboard and screen readers.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { ConfirmProvider, useConfirm } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const FRUIT = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
  { value: "durian", label: "Sầu riêng" },
] as const;
type Fruit = (typeof FRUIT)[number]["value"];

function Fruits({ onChange = () => {}, searchable = false }: { onChange?: (v: Fruit) => void; searchable?: boolean }) {
  const [value, setValue] = useState<Fruit>("banana");
  return (
    <Select<Fruit>
      label="Fruit"
      showLabel
      searchable={searchable}
      value={value}
      options={FRUIT}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe("Select", () => {
  it("shows the chosen option and opens a listbox on click", async () => {
    render(<Fruits />);
    const box = screen.getByRole("combobox", { name: "Fruit" });
    expect(box).toHaveTextContent("Banana");
    expect(box).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(screen.getByRole("option", { name: "Banana" })).toHaveAttribute("aria-selected", "true");
  });

  it("picks with the mouse and closes", async () => {
    const onChange = vi.fn();
    render(<Fruits onChange={onChange} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Fruit" }));
    await userEvent.click(screen.getByRole("option", { name: "Cherry" }));
    expect(onChange).toHaveBeenCalledWith("cherry");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Fruit" })).toHaveTextContent("Cherry");
  });

  it("works with the keyboard: arrows move, Enter picks, Esc closes", async () => {
    const onChange = vi.fn();
    render(<Fruits onChange={onChange} />);
    const box = screen.getByRole("combobox", { name: "Fruit" });
    box.focus();

    await userEvent.keyboard("{ArrowDown}"); // opens on the chosen option (Banana)
    expect(box).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Banana" }).id);
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(box).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Sầu riêng" }).id);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("durian");
    expect(box).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}{Home}{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1); // Esc changes nothing
  });

  it("jumps to an option when you type its first letters", async () => {
    const onChange = vi.fn();
    render(<Fruits onChange={onChange} />);
    screen.getByRole("combobox", { name: "Fruit" }).focus();
    await userEvent.keyboard("c"); // closed: picks straight away, like a native select
    expect(onChange).toHaveBeenLastCalledWith("cherry");
  });

  it("closes when you click outside", async () => {
    render(
      <>
        <Fruits />
        <p>outside</p>
      </>,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Fruit" }));
    await userEvent.click(screen.getByText("outside"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("filters long lists by search, ignoring Vietnamese accents", async () => {
    const onChange = vi.fn();
    render(<Fruits onChange={onChange} searchable />);
    await userEvent.click(screen.getByRole("combobox", { name: "Fruit" }));
    const search = screen.getByRole("combobox", { name: "Search fruit" });
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.type(search, "sau");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Sầu riêng"]);
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("durian");
  });
});

function DeleteThing({ onDeleted }: { onDeleted: () => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <Button
      onClick={async () => {
        if (await confirm({ title: "Delete this post?", confirmLabel: "Delete", danger: true })) {
          onDeleted();
          toast("Deleted");
        }
      }}
    >
      Delete
    </Button>
  );
}

describe("useConfirm", () => {
  const setup = () => {
    const onDeleted = vi.fn();
    render(
      <ToastProvider>
        <ConfirmProvider>
          <DeleteThing onDeleted={onDeleted} />
        </ConfirmProvider>
      </ToastProvider>,
    );
    return onDeleted;
  };

  it("asks in a dialog; Cancel has focus, so Enter can't delete by accident", async () => {
    const onDeleted = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this post?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("goes ahead when you confirm, and shows a message", async () => {
    const onDeleted = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(dialog.querySelectorAll("button")[1]);
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("Deleted");
  });

  it("keeps Tab inside the dialog", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const [cancel, ok] = screen.getByRole("dialog").querySelectorAll("button");
    await userEvent.tab();
    expect(ok).toHaveFocus();
    await userEvent.tab();
    expect(cancel).toHaveFocus();
  });
});
