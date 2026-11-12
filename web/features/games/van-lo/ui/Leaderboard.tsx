"use client";

// Stage 18: the cultivation leaderboard: everyone on Nook who plays Vân Lộ with a name, highest realm first.

import { CloudOff, Crown, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { getLeaderboard, type BoardRow } from "@/lib/api/games";
import { MAJOR_REALMS, PATHS, type PathId } from "../logic/data";

const realmOf = (level: number, lang: "vi" | "en") => {
  const major = Math.min(MAJOR_REALMS.length - 1, Math.floor((level - 1) / 9));
  const layer = level - major * 9;
  return lang === "vi" ? `${MAJOR_REALMS[major].vi} tầng ${layer}` : `${MAJOR_REALMS[major].en} ${layer}`;
};

export function Leaderboard({ lang }: { lang: "vi" | "en" }) {
  const t = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    getLeaderboard("van-lo").then(setRows, () => setOffline(true));
  }, []);

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Trophy className="h-5 w-5 text-primary" aria-hidden="true" /> {t("Bảng phong vân", "Cultivation ranking")}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {t("Cảnh giới cao nhất trước; cùng cảnh giới thì ai hạ nhiều yêu thú hơn.", "Highest realm first; on the same realm, whoever defeated more.")}
      </p>
      {offline && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <CloudOff className="h-5 w-5" aria-hidden="true" /> {t("Không kết nối được Nook.", "Can't reach Nook.")}
        </p>
      )}
      {rows?.length === 0 && (
        <p className="mt-4 text-sm text-muted">{t("Chưa có ai. Chọn tên trên Nook để lên bảng!", "Nobody yet. Pick a name on Nook to appear here!")}</p>
      )}
      {rows && rows.length > 0 && (
        <ol className="mt-4 flex flex-col gap-1">
          {rows.map((r) => {
            const path = PATHS[r.path as PathId];
            return (
              <li key={r.rank} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2", r.me ? "bg-primary/10" : "odd:bg-surface-muted")}>
                <span className="w-6 text-center font-bold tabular-nums text-muted">
                  {r.rank === 1 ? <Crown className="mx-auto h-5 w-5 text-amber-500" aria-label="1" /> : r.rank}
                </span>
                <Avatar name={r.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {r.name} {r.me && <span className="text-xs text-muted">({t("bạn", "you")})</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {path && (
                      <span className="font-semibold" style={{ color: `color-mix(in srgb, ${path.color} 55%, var(--text))` }}>
                        {t(path.vi, path.en)}
                      </span>
                    )}
                    {" · "}
                    {realmOf(r.level, lang)}
                  </span>
                </span>
                <span className="text-right text-xs text-muted tabular-nums">
                  {r.kills} {t("yêu thú", "defeated")}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
