"use client";

// Stage 17: the furnace (lò luyện) tab: alchemy, forging and talisman-making. Rules are in logic/craft.ts.

import { FlaskConical, Hammer, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { canCraft, craft, RECIPES, recipeName, recipeStones, SKILLS, successChance, xpToNext, type CraftSkill } from "../logic/craft";
import { ITEMS, MAJOR_REALMS, QUALITIES, type ItemId } from "../logic/data";
import type { Game } from "../logic/types";
import { sfx } from "./audio";

type Props = {
  game: Game;
  t: (vi: string, en: string) => string;
  update: <T>(change: (g: Game) => T, opts?: { saveNow?: boolean }) => T | undefined;
  toast: ReturnType<typeof useToast>;
};

const ICONS: Record<CraftSkill, typeof Hammer> = { alchemy: FlaskConical, forge: Hammer, talisman: ScrollText };

export function Furnace({ game, t, update, toast }: Props) {
  const p = game.player;
  const lang = game.lang;
  const recipes = RECIPES.filter((r) => r.minMajor <= p.major + 1); // show the next realm's recipes too, locked

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {(Object.keys(SKILLS) as CraftSkill[]).map((skill) => {
        const c = p.craft[skill];
        const Icon = ICONS[skill];
        return (
          <section key={skill} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5 shadow-card">
            <header className="flex items-center gap-3">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <div className="flex-1">
                <h2 className="text-lg font-bold">{t(SKILLS[skill].vi, SKILLS[skill].en)}</h2>
                <p className="text-xs text-muted">
                  {t("Cấp", "Level")} {c.level} · {c.xp}/{xpToNext(c)} {t("lần nữa để lên cấp", "more to level up")}
                </p>
              </div>
            </header>
            <ul className="flex flex-col gap-2">
              {recipes
                .filter((r) => r.skill === skill)
                .map((r) => {
                  const check = canCraft(game, r);
                  const locked = check.reason === "realm";
                  const chance = Math.round(successChance(r, c) * 100);
                  return (
                    <li key={r.id} className={cn("flex flex-col gap-1.5 rounded-2xl border border-border p-3", locked && "opacity-55")}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{recipeName(r, lang)}</span>
                        {skill !== "forge" && <span className="text-xs text-muted">{chance}%</span>}
                      </div>
                      <p className="text-xs text-muted">
                        {(Object.entries(r.needs) as [ItemId, number][]).map(([id, n], i) => (
                          <span key={id} className={cn((p.bag[id] ?? 0) < n && "text-rose-600 dark:text-rose-400")}>
                            {i > 0 && " + "}
                            {n} {t(ITEMS[id].vi, ITEMS[id].en)} ({p.bag[id] ?? 0})
                          </span>
                        ))}
                        {" · 💎"}
                        {recipeStones(r, p.major)}
                      </p>
                      {locked ? (
                        <Badge>{t(`Cần ${MAJOR_REALMS[r.minMajor].vi}`, `Needs ${MAJOR_REALMS[r.minMajor].en}`)}</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          className="self-start"
                          disabled={!check.ok}
                          onClick={() => {
                            const res = update((g) => craft(g, r.id), { saveNow: true });
                            if (!res?.ok) return;
                            sfx(res.success ? "craft" : "fail");
                            const made = res.item ? t(ITEMS[res.item].vi, ITEMS[res.item].en) : res.gear ? res.gear.name : "";
                            const quality = res.gear ? ` (${t(QUALITIES[res.gear.quality].vi, QUALITIES[res.gear.quality].en)})` : "";
                            toast(
                              res.success
                                ? t(`Thành công: ${made}${quality}!`, `Success: ${made}${quality}!`) +
                                    (res.levelUp ? t(" Tay nghề tăng!", " Your skill went up!") : "")
                                : t("Thất bại… nguyên liệu đã hóa tro.", "It failed… the materials turned to ash."),
                              { tone: res.success ? "success" : "error" },
                            );
                          }}
                        >
                          {skill === "alchemy" ? t("Luyện", "Brew") : skill === "forge" ? t("Rèn", "Forge") : t("Vẽ", "Draw")}
                        </Button>
                      )}
                      {check.reason === "bag" && <p className="text-xs text-muted">{t("Túi trang bị đã đầy.", "Your gear bag is full.")}</p>}
                    </li>
                  );
                })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-muted lg:col-span-3">
        {t(
          "Linh thảo hái trong bí cảnh, Yêu Đan rơi từ yêu thú, Huyền Thiết có trong rương; Phù Chỉ và Huyền Thiết cũng bán ở phường thị.",
          "Herbs grow in secret realms, beast cores drop from beasts, dark iron is in chests; talisman paper and dark iron are also sold in the market.",
        )}
      </p>
    </div>
  );
}
