"use client";

// Vân Lộ: the root. No save yet → the title screen. A run going on → the map. Otherwise → the cave abode.

import { Cloud, CloudOff, Loader2, Music, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMe } from "@/features/me/MeProvider";
import { subscribeTheme } from "@/features/theme/theme";
import { seedFrom } from "../engine/rng";
import { ELEMENTS, PATHS, ROOTS, TECHNIQUES, TREASURES, type PathId } from "../logic/data";
import { newGame, rootSpeed } from "../logic/player";
import type { Game, Lang } from "../logic/types";
import { Home } from "./Home";
import { RunScreen } from "./RunScreen";
import { getSound, setMusic, setSound, subscribeSound } from "./audio";
import { useGame, type CloudState } from "./useGame";

function useDark() {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.dataset.theme === "dark",
    () => false,
  );
}

export function VanLo() {
  const { game, loading, cloud, update, start, reset } = useGame();
  const dark = useDark();
  const confirm = useConfirm();
  useEffect(() => () => setMusic(null), []); // stop the music when you leave the game

  if (loading)
    return (
      <p className="flex items-center gap-2 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Đang mở động phủ…
      </p>
    );
  if (!game) return <Title onStart={start} />;

  const t = (vi: string, en: string) => (game.lang === "vi" ? vi : en);
  return (
    <div className="flex flex-col gap-4">
      {game.run ? <RunScreen game={game} update={update} dark={dark} /> : <Home game={game} update={update} />}
      {!game.run && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted">
          <CloudNote state={cloud} t={t} />
          <div className="flex flex-wrap items-center gap-2">
            <SoundToggles t={t} />
            <SegmentedControl<Lang>
              label={t("Ngôn ngữ", "Language")}
              options={[
                { value: "vi", label: "Tiếng Việt" },
                { value: "en", label: "English" },
              ]}
              value={game.lang}
              onChange={(lang) => update((g) => void (g.lang = lang))}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const ok = await confirm({
                  title: t("Bắt đầu lại từ đầu?", "Start over?"),
                  description: t("Xóa toàn bộ tiến độ của nhân vật này, trên mọi thiết bị.", "This deletes this character's progress, on every device."),
                  confirmLabel: t("Xóa và chơi lại", "Delete and restart"),
                  danger: true,
                });
                if (ok) await reset();
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("Chơi lại", "Start over")}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

function SoundToggles({ t }: { t: (vi: string, en: string) => string }) {
  const sound = useSyncExternalStore(subscribeSound, getSound, getSound);
  const btn = "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold transition";
  return (
    <>
      <button
        type="button"
        aria-pressed={sound.music}
        onClick={() => setSound({ music: !sound.music })}
        className={`${btn} ${sound.music ? "bg-surface-strong text-text" : "text-muted"}`}
      >
        <Music className="h-4 w-4" aria-hidden="true" /> {t("Nhạc", "Music")}
      </button>
      <button
        type="button"
        aria-pressed={sound.sfx}
        onClick={() => setSound({ sfx: !sound.sfx })}
        className={`${btn} ${sound.sfx ? "bg-surface-strong text-text" : "text-muted"}`}
      >
        {sound.sfx ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />} {t("Âm thanh", "Sound")}
      </button>
    </>
  );
}

function CloudNote({ state, t }: { state: CloudState; t: (vi: string, en: string) => string }) {
  if (state === "guest")
    return (
      <span>
        {t("Đang lưu trên trình duyệt này. Chọn tên trên Nook để lưu lên máy chủ.", "Saved in this browser. Pick a name on Nook to save to the server too.")}
      </span>
    );
  if (state === "offline")
    return (
      <span className="flex items-center gap-1.5">
        <CloudOff className="h-4 w-4" aria-hidden="true" /> {t("Chưa lưu lên Nook được; vẫn lưu trên máy này.", "Couldn't reach Nook; saved on this device.")}
      </span>
    );
  return (
    <span className="flex items-center gap-1.5">
      <Cloud className="h-4 w-4" aria-hidden="true" /> {state === "saving" ? t("Đang lưu…", "Saving…") : t("Đã lưu lên Nook", "Saved to Nook")}
    </span>
  );
}

function Title({ onStart }: { onStart: (g: Game) => void }) {
  const { user } = useMe();
  const [name, setName] = useState(user?.name ?? "");
  const [lang, setLang] = useState<Lang>("vi");
  const [path, setPath] = useState<PathId>("kiem");
  const [rolled, setRolled] = useState<Game | null>(null);
  const t = (vi: string, en: string) => (lang === "vi" ? vi : en);

  if (rolled) {
    const root = ROOTS.find((r) => r.count === rolled.player.root.length)!;
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-3xl border border-border bg-surface-strong p-8 text-center shadow-card">
        <p className="text-sm text-muted">{t("Trắc linh thạch sáng lên…", "The root-testing stone lights up…")}</p>
        <div className="flex gap-2">
          {rolled.player.root.map((e) => (
            <span
              key={e}
              className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
              style={{ background: ELEMENTS[e].color }}
            >
              {t(ELEMENTS[e].vi, ELEMENTS[e].en)}
            </span>
          ))}
        </div>
        <h2 className="text-2xl font-extrabold">{t(root.vi, root.en)}</h2>
        <p className="text-muted">
          {t(`Tốc độ tu luyện ×${rootSpeed(rolled.player.root)}.`, `Cultivation speed ×${rootSpeed(rolled.player.root)}.`)}{" "}
          {root.count === 1
            ? t("Thiên tư hiếm có!", "A rare talent!")
            : root.count >= 4
              ? t("Tư chất bình thường, nhưng đạo tâm mới là quan trọng.", "An ordinary talent, but a steady heart matters more.")
              : t("Một khởi đầu tốt.", "A good start.")}
        </p>
        <p className="text-sm text-muted">
          {(() => {
            const info = PATHS[rolled.player.path];
            const m = TECHNIQUES[info.start];
            const tr = TREASURES[info.treasure];
            return t(
              `Bạn nhận được ${m.vi}, pháp bảo ${tr.vi} và vài viên đan dược. Con đường ${info.vi} bắt đầu.`,
              `You receive the ${m.en}, the treasure ${tr.en} and a few pills. The path of the ${info.en.toLowerCase()} begins.`,
            );
          })()}
        </p>
        <Button variant="primary" size="lg" onClick={() => onStart(rolled)}>
          {t("Vào động phủ", "Enter your cave abode")}
        </Button>
      </section>
    );
  }

  return (
    <section
      className="relative mx-auto flex max-w-2xl flex-col gap-5 overflow-hidden rounded-3xl border border-border bg-surface-strong p-8 shadow-card"
      data-palette="ink"
    >
      <div>
        <p className="text-sm font-semibold tracking-[0.3em] text-muted uppercase">Nook Games</p>
        <h2 className="mt-1 text-5xl font-extrabold tracking-tight text-text">Vân Lộ</h2>
        <p className="mt-1 text-lg text-muted">{t("Đường mây — một hành trình tu tiên", "The Cloud Path — a cultivation journey")}</p>
      </div>
      <p className="text-muted">
        {t(
          "Bạn mới bước lên con đường tu tiên. Tu luyện trong động phủ, vào bí cảnh tìm cơ duyên, vượt thiên kiếp từ Luyện Khí tới Nguyên Anh. Mỗi chuyến đi là một bản đồ mới.",
          "You have just set foot on the path of cultivation. Train in your cave abode, seek fortune in secret realms, and survive the tribulations from Qi Refining to Nascent Soul. Every run is a new map.",
        )}
      </p>
      <SegmentedControl<Lang>
        label="Language"
        options={[
          { value: "vi", label: "Tiếng Việt" },
          { value: "en", label: "English" },
        ]}
        value={lang}
        onChange={setLang}
      />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("Chọn con đường tu luyện", "Choose your path")}</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(PATHS) as PathId[]).map((id) => {
            const info = PATHS[id];
            const on = id === path;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPath(id)}
                className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${on ? "border-primary bg-primary/10" : "border-border hover:bg-surface-muted"}`}
              >
                <span className="flex items-center gap-2 font-bold">
                  <span className="h-3 w-3 rounded-full" style={{ background: info.color }} aria-hidden="true" />
                  {t(info.vi, info.en)}
                </span>
                <span className="text-xs text-muted">{t(info.about, info.aboutEn)}</span>
                <span className="text-xs font-semibold" style={{ color: info.color }}>
                  {t(info.resource.vi, info.resource.en)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const g = newGame(name.trim() || t("Vô Danh", "Nameless"), seedFrom(), Date.now(), path);
          g.lang = lang;
          setRolled(g);
        }}
      >
        <Input label={t("Đạo hiệu", "Your cultivator name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="flex-1" />
        <Button type="submit" variant="primary" size="lg">
          {t("Trắc linh căn", "Test your root")}
        </Button>
      </form>
    </section>
  );
}
