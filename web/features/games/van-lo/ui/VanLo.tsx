"use client";

// Vân Lộ: the root. No save yet → the title screen. A run going on → the map. Otherwise → the cave abode.

import { Cloud, CloudOff, Loader2, RotateCcw } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMe } from "@/features/me/MeProvider";
import { subscribeTheme } from "@/features/theme/theme";
import { seedFrom } from "../engine/rng";
import { ELEMENTS, ROOTS } from "../logic/data";
import { newGame, rootSpeed } from "../logic/player";
import type { Game, Lang } from "../logic/types";
import { Home } from "./Home";
import { RunScreen } from "./RunScreen";
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
          {t(
            "Bạn nhận được Thanh Phong Kiếm Quyết, phi kiếm Thanh Hồng Kiếm và vài viên đan dược. Con đường kiếm tu bắt đầu.",
            "You receive the Clear Wind Sword Art, the flying sword Azure Rainbow and a few pills. The sword path begins.",
          )}
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
          "Bạn là một kiếm tu mới nhập đạo. Tu luyện trong động phủ, vào bí cảnh tìm cơ duyên, vượt thiên kiếp để Trúc Cơ. Mỗi chuyến đi là một bản đồ mới.",
          "You are a new sword cultivator. Cultivate in your cave abode, seek fortune in secret realms, and survive the tribulation to reach Foundation. Every run is a new map.",
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
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const g = newGame(name.trim() || t("Vô Danh", "Nameless"), seedFrom());
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
