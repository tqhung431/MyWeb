# Stage 15 — Design system: colour themes, our own dropdowns, Figma

**Goal:** make every app look and behave the same, in any colour theme. Until now some menus were the browser's
own `<select>` boxes and some questions were the browser's grey `confirm()` boxes. They ignored Nook's colours,
corners and dark mode, and looked different on every phone. Stage 15 replaces them with Nook's own components,
adds six colour themes, a `/design` page that shows every component, and a Figma library with the same pieces.

This stage gets the parts ready for Stage 16 (Nook Games): the game's menus, inventory and settings are built from
these components.

## 1. Colour themes

Pick one in the sidebar (desktop) or with the palette button at the top of the screen (phone).

| Theme | Feel |
| --- | --- |
| **Nook** | Calm indigo, the original |
| **Bamboo** | Fresh green, quiet |
| **Ink & Paper** (Thủy mặc) | Black ink on rice paper, a red seal; matches the cultivation game |
| **Sunset** | Warm orange and rose |
| **Ocean** | Cool teal and blue |
| **Lotus** | Soft pink and lavender |

Each comes in light and dark, so there are 12 looks. The choice is saved in the browser, like light/dark.

**How it works.** Every colour in Nook comes from a few CSS variables ("tokens"): `--background`, `--surface`,
`--text`, `--muted`, `--primary`… Tailwind turns them into classes like `bg-surface` and `text-muted`.
A theme is just another set of values:

```css
/* web/app/palettes.css */
[data-palette="bamboo"]                    { --primary: #23733f; ... }
[data-palette="bamboo"][data-theme="dark"] { --primary: #4ade80; ... }
```

A tiny script in `<head>` (`themeScript` in `features/theme/theme.ts`) puts `data-palette` and `data-theme` on
`<html>` before the page is drawn, so there's no flash of the wrong colours.

The selectors use `[data-palette]`, not `:root`, so **any element** can show another theme inside the page. The
theme picker's swatches and the previews on `/design` use this: `<span data-palette="ocean" data-theme="dark">`
draws itself in Ocean dark.

**Readable in every theme.** `tests/palettes.test.ts` reads `palettes.css` and checks the WCAG contrast of every
theme: text and muted text against the page and cards (at least 7:1 and 4.5:1), button text against the
primary colours, and the primary colour against the page. Change a colour badly and the test fails.

## 2. Our own components

| Component | File | Replaces |
| --- | --- | --- |
| **Select** (dropdown) | `components/ui/Select.tsx` | 7 native `<select>`s: WatchList status, quiz category (lobby and room), song genre, book shelf and book status, habit "How often" |
| **Dialog** + `useConfirm()` | `components/ui/Dialog.tsx` | 8 `window.confirm()` boxes (delete a post, a habit, a book, a group…) |
| **Toast** + `useToast()` | `components/ui/Toast.tsx` | `window.alert()`; short "Saved" / "Couldn't delete" messages |
| **Textarea** | `components/ui/Textarea.tsx` | — (new, same style as `Input`) |
| **Popover** | `components/ui/Popover.tsx` | — (the phone theme picker) |
| Button `danger` | `components/ui/Button.tsx` | red "Delete" buttons |

### The dropdown, step by step

```tsx
<Select label="Shelf" showLabel value={status} onChange={setStatus}
        options={[{ value: "reading", label: "Reading now" }, { value: "want", label: "Want to read" }]} />
```

- **Looks:** `variant="field"` (like a text box, with a label) or `variant="pill"` (small, for cards and toolbars,
  `size="xs" | "sm" | "md"`). Options can have an icon and a second line (`hint`).
- **On phones** the list opens as a **sheet from the bottom** with big rows, easy to tap with a thumb.
- **On desktop** it opens under the button, or above it when there's no room below. It's drawn in a **portal**
  (at the end of `<body>`, `position: fixed`), so a card with `overflow: hidden` can't cut it off.
  `lib/floating.ts` has the positioning and "tap outside to close" helpers.
- **Long lists** get `searchable`: a search box at the top. It ignores Vietnamese accents ("sau" finds "Sầu riêng").
- **Keyboard and screen readers** follow the WAI-ARIA *select-only combobox* pattern: focus stays on the button
  (`role="combobox"`), the list is a `listbox` of `option`s, and `aria-activedescendant` says which option is active.
  Keys: ↓ ↑ Home End PageUp PageDown to move, Enter or Space to pick, Esc to close, or type letters to jump,
  as in a native select.

### Dialogs

```tsx
const confirm = useConfirm();
if (!(await confirm({ title: "Delete this post?", confirmLabel: "Delete", danger: true }))) return;
```

`useConfirm()` returns a Promise, like `window.confirm()` but in Nook's style. The dialog is **modal**: focus moves
into it (onto **Cancel**, so pressing Enter can't delete by accident), Tab stays inside, Esc closes, and focus
returns to the button you came from. On phones it slides up from the bottom.

## 3. The /design page

**/design** (link at the bottom of **About**) shows every component in every state, drawn in your current theme:
the six themes (tap to switch), the tokens, buttons, fields and dropdowns, choices, dialogs and messages, badges,
avatars and icons. When something looks off in one theme, it shows up here first.

## 4. The Figma library

File: **Nook design system** in your Figma drafts —
https://www.figma.com/design/G3numOlj2x4L7kiiSlBuGT

- **Variables:** the collection "Nook colours" has all 156 colours, named `palette/mode/token`
  (e.g. `bamboo/dark/primary`), the same names as the CSS tokens. (Figma's free plan allows one *mode* per
  collection, so light/dark are in the names rather than as modes. On a paid plan they could become modes and
  you'd switch a whole frame's theme with one click.)
- **Foundations:** the six themes, light and dark, drawn with their own variables.
- **Components** (bound to the Nook light variables): Button (4 variants × 3 sizes, with a Label property),
  Input (default, focus, error), Select (field, open list, pill), Badge, SegmentedControl, Avatar, AppIcon, Card,
  Dialog (using Button instances), Toast (info, success, error), BottomNav. Each component's description names
  its file in `web/components`.

It was built with the Figma connection (the Plugin API, by script). Code and Figma are **not linked
automatically**: when a component changes in code, its Figma twin needs updating too. Figma's *Code Connect*
can link them, but it needs a paid plan.

## 5. Try it

1. Open **/design**. Switch themes in the sidebar, or tap a theme card.
2. Open the **Realm** dropdown: click, or Tab to it and press ↓. Type "k" to jump to Kết Đan.
3. On a phone (or a narrow window), open a dropdown: it comes up from the bottom.
4. In **WatchList**, change a show's status; in **Habits**, add a habit and pick "How often".
5. Delete something (a post, a habit): Nook's own dialog asks first.

## What wasn't tested

- Real phones (only Playwright's iPhone 13). VoiceOver/TalkBack weren't tried; the ARIA roles are tested with
  Testing Library.
- The Figma file was checked with screenshots only.
