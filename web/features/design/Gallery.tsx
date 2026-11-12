"use client";

// Stage 15: the /design page. Every shared component in every state, drawn with the current theme,
// so an ugly corner shows up at a glance. Playwright screenshots this page in each theme.
// The same components live in the Figma library (see docs/stage-15.md).

import { Bell, Check, Gamepad2, Heart, Music2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog, useConfirm } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { PALETTES } from "@/features/theme/palettes";
import { ModeSwitch, PalettePicker } from "@/features/theme/ThemeSwitcher";
import { setPalette } from "@/features/theme/theme";
import { StatusSelect } from "@/features/watch/bits";
import type { Status } from "@/lib/api/watch";

const TOKENS = ["background", "surface-strong", "surface-muted", "border", "text", "muted", "primary", "primary-2", "on-primary", "glow-1", "glow-2", "glow-3"];

const REALMS = [
  { value: "luyen-khi", label: "Luyện Khí", hint: "Qi Refining · 9 layers" },
  { value: "truc-co", label: "Trúc Cơ", hint: "Foundation" },
  { value: "ket-dan", label: "Kết Đan", hint: "Golden Core" },
  { value: "nguyen-anh", label: "Nguyên Anh", hint: "Nascent Soul" },
  { value: "hoa-than", label: "Hóa Thần", hint: "Spirit Severing" },
];
const GENRES = ["Lo-fi", "Pop", "Rock", "Jazz", "Classical", "Electronic", "Hip-hop", "Folk", "Ambient", "Soundtrack", "V-pop", "K-pop"].map((g) => ({
  value: g,
  label: g,
}));

export function Gallery() {
  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Design system</h1>
        <p className="mt-2 text-muted">
          Every shared piece of Nook in one place, drawn in your current theme. Apps build their screens from these, so a fix here fixes every app.
        </p>
      </div>

      <Themes />
      <Buttons />
      <Fields />
      <Choices />
      <Feedback />
      <Bits />
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      {children}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[9rem_1fr] sm:items-center">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

// A tiny page in each palette: data-palette and data-theme on the tile switch its tokens.
function Themes() {
  return (
    <Section title="Colour themes" subtitle="Six palettes, each light and dark. Tap one to use it.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPalette(p.id)}
            className="cursor-pointer overflow-hidden rounded-2xl border border-border text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="grid grid-cols-2">
              {(["light", "dark"] as const).map((mode) => (
                <span key={mode} data-palette={p.id} data-theme={mode} className="flex flex-col gap-2 bg-background p-3 text-text">
                  <span className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-strong p-2.5 shadow-card">
                    <span className="text-xs font-bold">{mode === "light" ? "Light" : "Dark"}</span>
                    <span className="text-[0.65rem] leading-tight text-muted">Muted text</span>
                    <span className="mt-1 inline-flex h-6 items-center justify-center rounded-full bg-linear-to-r from-primary to-primary-2 text-[0.65rem] font-semibold text-on-primary">
                      Button
                    </span>
                  </span>
                </span>
              ))}
            </span>
            <span className="flex items-baseline justify-between gap-2 bg-surface-strong px-3 py-2">
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="truncate text-xs text-muted">{p.feel}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-6 mb-3 text-xs font-semibold tracking-wide text-muted uppercase">Tokens in the current theme</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {TOKENS.map((t) => (
          <li key={t} className="flex flex-col gap-1">
            <span className="h-10 rounded-xl border border-border" style={{ background: `var(--${t})` }} />
            <code className="truncate text-[0.7rem] text-muted">{t}</code>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Buttons() {
  return (
    <Section title="Buttons">
      <Row label="Variants">
        <Button variant="primary">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Primary
        </Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Danger
        </Button>
      </Row>
      <Row label="Sizes">
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary">Medium</Button>
        <Button variant="primary" size="lg">
          Large
        </Button>
        <Button size="icon" aria-label="Add">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Button>
      </Row>
      <Row label="Disabled">
        <Button variant="primary" disabled>
          Primary
        </Button>
        <Button disabled>Secondary</Button>
      </Row>
    </Section>
  );
}

function Fields() {
  const [realm, setRealm] = useState("truc-co");
  const [genre, setGenre] = useState("Lo-fi");
  const [often, setOften] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>("watching");
  const [shelf, setShelf] = useState("reading");

  return (
    <Section title="Fields and dropdowns" subtitle="Dropdowns open as a sheet from the bottom on phones. Try the keyboard: ↓ ↑, Enter, Esc, or type a letter.">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Input label="Name" placeholder="e.g. Bou" hint="Others on Nook see this name." />
        <Input label="Group name" defaultValue="x" error="At least 2 letters, please." />
        <Select label="Realm" showLabel value={realm} onChange={setRealm} options={REALMS} />
        <Select label="Genre" showLabel searchable value={genre} onChange={setGenre} options={GENRES} />
        <Select
          label="How often"
          showLabel
          value={often}
          onChange={setOften}
          placeholder="Pick how often…"
          options={["Every day", "5 days a week", "3 days a week", "Once a week"].map((v) => ({ value: v, label: v }))}
        />
        <Select label="Locked" showLabel disabled value="soon" onChange={() => {}} options={[{ value: "soon", label: "Coming soon" }]} />
        <Textarea label="A short note" placeholder="What did you think?" hint="Up to 500 letters." className="md:col-span-2" rows={3} />
        <label className="relative md:col-span-2">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search box…"
            className="h-12 w-full rounded-full border border-border bg-surface-strong/70 pr-4 pl-12 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
          />
        </label>
      </div>
      <div className="mt-6 border-t border-border pt-4">
        <Row label="Small dropdowns">
          <StatusSelect value={status} onChange={(s) => setStatus(s === "remove" ? null : s)} allowRemove={!!status} />
          <StatusSelect value={null} onChange={(s) => s !== "remove" && setStatus(s)} />
          <Select
            label="Shelf"
            variant="pill"
            value={shelf}
            onChange={setShelf}
            options={[
              { value: "want", label: "Want to read" },
              { value: "reading", label: "Reading" },
              { value: "finished", label: "Finished" },
            ]}
          />
        </Row>
      </div>
    </Section>
  );
}

function Choices() {
  const [mode, setMode] = useState<"all" | "tv" | "anime">("all");
  return (
    <Section title="Choices">
      <Row label="Segmented">
        <SegmentedControl
          label="What to search"
          options={[
            { value: "all", label: "All" },
            { value: "tv", label: "TV" },
            { value: "anime", label: "Anime" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Row>
      <Row label="Light / dark">
        <div className="w-full max-w-xs">
          <ModeSwitch />
        </div>
      </Row>
      <Row label="Colour theme">
        <div className="w-full max-w-sm">
          <PalettePicker />
        </div>
      </Row>
    </Section>
  );
}

function Feedback() {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  return (
    <Section title="Dialogs and messages">
      <Row label="Dialog">
        <Button onClick={() => setOpen(true)}>Open a dialog</Button>
        <Button
          onClick={async () => {
            const ok = await confirm({ title: "Delete this post?", description: "Its comments go too.", confirmLabel: "Delete", danger: true });
            toast(ok ? "Deleted (not really, it's a demo)" : "Kept it", { tone: ok ? "success" : "info" });
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Ask before deleting
        </Button>
      </Row>
      <Row label="Messages">
        <Button onClick={() => toast("Added to your list", { tone: "success" })}>
          <Check className="h-4 w-4" aria-hidden="true" /> Success
        </Button>
        <Button onClick={() => toast("Your timer is in the bottom bar")}>
          <Bell className="h-4 w-4" aria-hidden="true" /> Info
        </Button>
        <Button onClick={() => toast("Couldn't save: can't reach Nook", { tone: "error" })}>Error</Button>
      </Row>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Breakthrough to Trúc Cơ?"
        description="A heavenly tribulation will strike. Make sure your qi is full."
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Break through
            </Button>
          </>
        }
      />
    </Section>
  );
}

function Bits() {
  return (
    <Section title="Badges, avatars and icons">
      <Row label="Badges">
        <Badge>Neutral</Badge>
        <Badge tone="primary">Primary</Badge>
        <Badge tone="success">Success</Badge>
        <Badge>★ 8.6</Badge>
      </Row>
      <Row label="Avatars">
        <Avatar name="Bou Tran" size="sm" />
        <Avatar name="Mai 🌸" />
        <Avatar name="Dad" size="lg" />
        <Avatar />
      </Row>
      <Row label="App icons">
        <AppIcon icon={Music2} accent="from-pink-500 to-rose-500" size="sm" />
        <AppIcon icon={Gamepad2} accent="from-amber-400 to-orange-500" />
        <AppIcon icon={Heart} accent="from-emerald-400 to-teal-500" size="lg" />
      </Row>
      <Row label="Text">
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-bold tracking-tight">Heading</p>
          <p>Body text for reading.</p>
          <p className="text-sm text-muted">Muted text for hints and details.</p>
          <p className="text-sm font-semibold text-primary">Primary text for links and highlights.</p>
        </div>
      </Row>
    </Section>
  );
}
