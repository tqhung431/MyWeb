import { apiFetch } from "./client";
import { clientId } from "./clientId";
import { timeZone } from "./timezone";

export type Achievement = {
  code: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name, chosen by the API
  earnedAt: string | null;
};

export function getAchievements(): Promise<Achievement[]> {
  return apiFetch<Achievement[]>("/api/achievements", {
    headers: { "X-Client-Id": clientId(), "X-Time-Zone": timeZone() },
  });
}
