"use client";

// Stage 22: the chess front page. Play someone live (a room with a 4-letter code), play Nook (the computer,
// 4 levels, in your browser), or two people on one screen. Ratings and recent games below.

import { Bot, Eye, LogIn, Plus, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import { getChessBoard, getChessGames, type ChessGameRow, type OpenChessRoom, type RatingRow, type TimeControl } from "@/lib/api/arena";
import { cn } from "@/lib/cn";
import { tx } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/I18nProvider";
import { Piece } from "./pieces";
import { useResultText } from "./parts";

const TIME_CONTROLS: { value: TimeControl; label: string }[] = [
  { value: "5+0", label: tx("5 min") },
  { value: "10+0", label: tx("10 min") },
  { value: "15+10", label: tx("15 min + 10 s") },
  { value: "none", label: tx("No clock") },
];
const COLORS = [
  { value: "random", label: tx("Random") },
  { value: "w", label: tx("White") },
  { value: "b", label: tx("Black") },
] as const;
const LEVEL_NAMES = [tx("Sprout"), tx("Walker"), tx("Climber"), tx("Summit")];

export function ChessLobby() {
  const t = useT();
  const { user } = useMe();
  const { connected, ask } = useArena();
  const router = useRouter();
  const resultText = useResultText();
  const [timeControl, setTimeControl] = useState<TimeControl>("10+0");
  const [color, setColor] = useState<"random" | "w" | "b">("random");
  const [level, setLevel] = useState(2);
  const [nookColor, setNookColor] = useState<"w" | "b">("w");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<OpenChessRoom[]>([]);
  const [board, setBoard] = useState<RatingRow[]>([]);
  const [games, setGames] = useState<ChessGameRow[]>([]);

  const loadRooms = useCallback(() => void ask("arena:rooms", { kind: "chess" }).then((a) => a.ok && setRooms(a.rooms as OpenChessRoom[])), [ask]);
  useEffect(() => {
    if (connected) loadRooms();
  }, [connected, loadRooms]);
  useArenaEvent<{ kind: string }>("arena:rooms", (e) => e.kind === "chess" && loadRooms());
  useEffect(() => {
    getChessBoard().then(setBoard, () => {});
    getChessGames().then(setGames, () => {});
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    const a = await ask("chess:create", { timeControl, color });
    setBusy(false);
    if (a.ok && a.code) router.push(`/arena/chess/${a.code}`);
    else setError(a.error ?? t("That didn't work"));
  };
  const join = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 4) router.push(`/arena/chess/${code}`);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-800 via-indigo-900 to-violet-800 p-6 text-white shadow-card sm:p-8">
          <div className="pointer-events-none absolute -top-4 -right-6 flex rotate-12 gap-1 opacity-90" aria-hidden="true">
            <Piece type="k" color="w" className="h-28 w-28 sm:h-36 sm:w-36" />
            <Piece type="q" color="b" className="mt-10 h-24 w-24 sm:h-32 sm:w-32" />
          </div>
          <h2 className="relative text-2xl font-extrabold sm:text-3xl">{t("Chess")}</h2>
          <p className="relative mt-1 max-w-sm text-white/85">{t("Play live against anyone on Nook, with clocks and ratings. The game server keeps the rules fair.")}</p>
          {user ? (
            <div className="relative mt-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select<TimeControl>
                  label={t("Clock")}
                  variant="pill"
                  size="md"
                  value={timeControl}
                  onChange={setTimeControl}
                  options={TIME_CONTROLS.map((o) => ({ value: o.value, label: t(o.label) }))}
                  className="w-44"
                  buttonClassName="bg-white/15 text-white backdrop-blur focus-visible:ring-white"
                />
                <Select<"random" | "w" | "b">
                  label={t("Your colour")}
                  variant="pill"
                  size="md"
                  value={color}
                  onChange={setColor}
                  options={COLORS.map((o) => ({ value: o.value, label: t(o.label) }))}
                  className="w-36"
                  buttonClassName="bg-white/15 text-white backdrop-blur focus-visible:ring-white"
                />
              </div>
              <Button variant="light" size="md" className="self-start" onClick={create} disabled={!connected || busy}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("Start a live game")}
              </Button>
              {error && <p className="text-sm text-rose-200">{error}</p>}
              {!connected && <p className="text-sm text-white/70">{t("Connecting to the game server…")}</p>}
            </div>
          ) : null}
        </section>

        {!user && <NeedName why={t("Pick a name to play live. You can still play Nook without one.")} />}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title={t("Play Nook")} subtitle={t("The computer, in your browser. Works offline.")} />
            <div className="flex flex-col gap-3">
              <div role="radiogroup" aria-label={t("Level")} className="grid grid-cols-4 gap-1.5">
                {LEVEL_NAMES.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={level === i + 1}
                    onClick={() => setLevel(i + 1)}
                    className={cn(
                      "flex cursor-pointer flex-col items-center rounded-2xl border px-1 py-2 text-xs font-semibold transition",
                      level === i + 1 ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="text-lg font-extrabold">{i + 1}</span>
                    {t(name)}
                  </button>
                ))}
              </div>
              <SegmentedControl
                label={tx("Your colour")}
                value={nookColor}
                onChange={setNookColor}
                options={[
                  { value: "w", label: tx("White") },
                  { value: "b", label: tx("Black") },
                ]}
              />
              <Link href={`/arena/chess/nook?level=${level}&color=${nookColor}`} className={buttonClasses("primary", "md", "self-start")}>
                <Bot className="h-4 w-4" aria-hidden="true" /> {t("Play Nook")}
              </Link>
              <Link href="/arena/chess/local" className="text-sm font-semibold text-primary hover:underline">
                {t("Or two people on this screen")} →
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("Join with a code")} subtitle={t("Got a code from a friend? Type the 4 letters.")} />
            <form onSubmit={join} className="flex gap-2">
              <input
                value={code}
                onChange={(e) =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z]/g, "")
                      .slice(0, 4),
                  )
                }
                placeholder="ABCD"
                aria-label={t("Room code")}
                autoCapitalize="characters"
                className="h-12 w-32 rounded-2xl border border-border bg-surface-strong/70 text-center text-2xl font-bold tracking-[0.3em] uppercase focus:border-primary focus:outline-none"
              />
              <Button type="submit" variant="primary" disabled={code.length !== 4}>
                <LogIn className="h-4 w-4" aria-hidden="true" /> {t("Join")}
              </Button>
            </form>
            <h3 className="mt-5 mb-2 text-sm font-bold">{t("Open games")}</h3>
            {rooms.length === 0 ? (
              <p className="text-sm text-muted">{t("Nobody is waiting. Start a game and share the code!")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rooms.map((r) => (
                  <li key={r.code}>
                    <Link href={`/arena/chess/${r.code}`} className="flex items-center gap-3 rounded-2xl border border-border p-3 transition hover:border-primary/40">
                      <span className="rounded-xl bg-indigo-500/12 px-2.5 py-1.5 font-mono text-sm font-bold text-indigo-600 dark:text-indigo-300">{r.code}</span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-semibold">
                          {r.white ?? "…"} – {r.black ?? "…"}
                        </span>
                        <span className="text-xs text-muted">
                          {t(TIME_CONTROLS.find((x) => x.value === r.timeControl)?.label ?? "")} · {r.status === "waiting" ? t("Waiting for a player") : t("Playing")}
                        </span>
                      </span>
                      {r.status === "waiting" ? <Users className="h-4 w-4 text-muted" aria-hidden="true" /> : <Eye className="h-4 w-4 text-muted" aria-label={t("Watch")} />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title={t("Recent games")} subtitle={t("Tap one to replay it")} />
          {games.length === 0 ? (
            <p className="text-sm text-muted">{t("No games yet.")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {games.map((g) => (
                <li key={g.id}>
                  <Link href={`/arena/chess/game/${g.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {g.whiteName} – {g.blackName}
                      </span>
                      <span className="block truncate text-xs text-muted">{resultText(g, g.whiteName, g.blackName)}</span>
                    </span>
                    <span className="font-mono text-sm font-bold">{g.result === "1/2-1/2" ? "½–½" : g.result.replace("-", "–")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader title={t("Ratings")} subtitle={t("Live games only. Everyone starts at 1200.")} />
        {board.length === 0 ? (
          <p className="text-sm text-muted">{t("Play a live game to get a rating.")}</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {board.map((r) => (
              <li key={r.rank} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", r.me && "bg-primary/10")}>
                <span className="w-6 text-center text-sm font-bold text-muted">{r.rank === 1 ? <Trophy className="mx-auto h-4 w-4 text-amber-500" aria-label="1" /> : r.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="text-xs text-muted">
                  {r.wins}/{r.draws}/{r.losses}
                </span>
                <span className="w-12 text-right font-mono text-sm font-bold">{r.rating}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
