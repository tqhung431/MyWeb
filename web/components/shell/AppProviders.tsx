"use client";

// Every app-wide provider, in one place. Order matters: inner providers can use outer ones
// (FocusProvider reads the signed-in user to reload your sessions after login/logout).

import type { ReactNode } from "react";
import { ConfirmProvider } from "@/components/ui/Dialog";
import { ToastProvider } from "@/components/ui/Toast";
import { AchievementsProvider } from "@/features/achievements/AchievementsProvider";
import { AmbientProvider } from "@/features/ambient/AmbientProvider";
import { MeProvider } from "@/features/me/MeProvider";
import { FocusProvider } from "@/features/focus/FocusProvider";
import { HabitReminders } from "@/features/habits/Reminders";
import { OfflineSync } from "@/features/habits/OfflineSync";
import { ServiceWorker } from "@/features/habits/ServiceWorker";
import { MusicProvider } from "@/features/music/MusicProvider";
import { RealtimeProvider } from "@/features/realtime/RealtimeProvider";
import type { User } from "@/lib/api/me";

export function AppProviders({ initialUser, children }: { initialUser: User | null; children: ReactNode }) {
  return (
    <MeProvider initialUser={initialUser}>
      <RealtimeProvider>
        <AmbientProvider>
          <AchievementsProvider>
            <FocusProvider>
              <MusicProvider>
                <ToastProvider>
                  <ConfirmProvider>{children}</ConfirmProvider>
                </ToastProvider>
                <HabitReminders />
                <OfflineSync />
                <ServiceWorker />
              </MusicProvider>
            </FocusProvider>
          </AchievementsProvider>
        </AmbientProvider>
      </RealtimeProvider>
    </MeProvider>
  );
}
