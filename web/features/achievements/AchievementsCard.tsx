"use client";

import { CloudOff } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useAchievements } from "./AchievementsProvider";
import { BadgeIcon } from "./BadgeIcon";

export function AchievementsCard() {
  const { list, status } = useAchievements();
  const earned = list.filter((a) => a.earnedAt).length;

  return (
    <Card aria-labelledby="badges-title">
      <CardHeader
        id="badges-title"
        title="Achievements"
        subtitle={status === "ready" ? `${earned} of ${list.length} unlocked` : " "}
      />

      {status === "offline" && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CloudOff className="h-5 w-5" aria-hidden="true" /> Offline. Badges appear when the API is running.
        </p>
      )}

      {status === "loading" && (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="mx-auto h-14 w-14 animate-pulse rounded-full bg-surface-muted" />
          ))}
        </div>
      )}

      {status === "ready" && (
        <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
          {list.map((a) => (
            <li key={a.code} className="flex flex-col items-center gap-1.5 text-center" title={a.description}>
              <BadgeIcon name={a.icon} earned={Boolean(a.earnedAt)} />
              <span className={cn("text-xs leading-tight font-semibold", !a.earnedAt && "text-muted")}>{a.title}</span>
              <span className="sr-only">
                {a.earnedAt ? "Unlocked." : "Locked."} {a.description}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
