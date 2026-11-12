"use client";

// Stage 22: screen sharing on Nook TV. The admin shares one browser tab (with its sound); everyone else watches.
//
// The video doesn't pass through Nook's server: it goes straight from the admin's browser to each viewer's
// (WebRTC, one connection per viewer). The game server only passes along the short messages the two browsers
// need to find each other ("signalling"). On a home network that's all it takes; no outside server is used.
//
//   viewer: tv:watch ──► server ──► admin: tv:viewer {id}
//   admin: offer ──► tv:signal ──► viewer: answer ──► tv:signal ──► admin      (+ network candidates both ways)

import { Loader2, MonitorUp, Radio, Square, Users, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import { getAdmin } from "@/lib/api/arena";
import { useT } from "@/lib/i18n/I18nProvider";

type Signal = { from: string; data: { type?: "offer" | "answer"; sdp?: string; candidate?: RTCIceCandidateInit } };

export function TvLive() {
  const t = useT();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    getAdmin().then(
      (a) => setIsAdmin(a.isAdmin),
      () => setIsAdmin(false),
    );
  }, []);
  if (isAdmin === null) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;
  return isAdmin ? <Sharer /> : <Viewer />;
}

function Sharer() {
  const t = useT();
  const { ask, socket } = useArena();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const peers = useRef(new Map<string, RTCPeerConnection>());
  const preview = useRef<HTMLVideoElement>(null);
  const [viewers, setViewers] = useState(0);

  const stop = () => {
    stream?.getTracks().forEach((tr) => tr.stop());
    peers.current.forEach((pc) => pc.close());
    peers.current.clear();
    setViewers(0);
    setStream(null);
    socket?.emit("tv:stop");
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setError("");
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError(t("This browser can't share a screen. Use Chrome, Edge or Firefox on a computer."));
      return;
    }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      s.getVideoTracks()[0].addEventListener("ended", () => stop());
      const a = await ask("tv:share");
      if (!a.ok) {
        s.getTracks().forEach((tr) => tr.stop());
        setError(a.error ?? t("That didn't work"));
        return;
      }
      setStream(s);
      if (preview.current) preview.current.srcObject = s;
    } catch {
      setError(t("Sharing was cancelled."));
    }
  };

  // A viewer arrived: make a connection for them and send the offer
  useArenaEvent<{ id: string }>("tv:viewer", async ({ id }) => {
    if (!stream || !socket) return;
    peers.current.get(id)?.close();
    const pc = new RTCPeerConnection();
    peers.current.set(id, pc);
    setViewers(peers.current.size);
    stream.getTracks().forEach((tr) => pc.addTrack(tr, stream));
    pc.onicecandidate = (e) => e.candidate && socket.emit("tv:signal", { to: id, data: { candidate: e.candidate.toJSON() } });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        peers.current.delete(id);
        setViewers(peers.current.size);
      }
    };
    await pc.setLocalDescription(await pc.createOffer());
    socket.emit("tv:signal", { to: id, data: { type: "offer", sdp: pc.localDescription!.sdp } });
  });
  useArenaEvent<Signal>("tv:signal", async ({ from, data }) => {
    const pc = peers.current.get(from);
    if (!pc) return;
    if (data.type === "answer" && data.sdp) await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
    else if (data.candidate) await pc.addIceCandidate(data.candidate).catch(() => {});
  });
  useArenaEvent<{ id: string }>("tv:viewer-left", ({ id }) => {
    peers.current.get(id)?.close();
    peers.current.delete(id);
    setViewers(peers.current.size);
  });

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-linear-to-br from-rose-600 to-red-500 text-white">
            <MonitorUp className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{stream ? t("You're live") : t("Share a tab with everyone")}</p>
            <p className="text-sm text-muted">
              {stream ? t("{n} watching", { n: viewers }) : t("Pick a browser tab and tick “Share tab audio”. Everyone on Nook TV can watch; nobody else can control it.")}
            </p>
          </div>
          {stream ? (
            <Button variant="danger" onClick={stop}>
              <Square className="h-4 w-4" aria-hidden="true" /> {t("Stop sharing")}
            </Button>
          ) : (
            <Button variant="primary" onClick={start}>
              <Radio className="h-4 w-4" aria-hidden="true" /> {t("Start sharing")}
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}
      </Card>
      <div className="overflow-hidden rounded-3xl bg-black shadow-card">
        <video ref={preview} autoPlay muted playsInline className="aspect-video w-full" aria-label={t("Your shared screen")} />
      </div>
      <p className="text-xs text-muted">{t("The video goes straight from this browser to each viewer on your network, not through Nook's server.")}</p>
    </div>
  );
}

function Viewer() {
  const t = useT();
  const { ask, socket, connected } = useArena();
  const [live, setLive] = useState<{ live: boolean; by: string | null } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const video = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);

  const watch = async () => {
    pc.current?.close();
    pc.current = null;
    setPlaying(false);
    await ask("tv:watch");
  };

  useEffect(() => {
    if (!connected) return;
    void ask("tv:status").then((a) => {
      const l = { live: !!a.live, by: (a.by as string) ?? null };
      setLive(l);
      if (l.live) void watch();
    });
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => pc.current?.close(), []);

  useArenaEvent<{ live: boolean; by: string | null }>("tv:live", (l) => {
    setLive(l);
    if (l.live) void watch();
    else {
      pc.current?.close();
      pc.current = null;
      setPlaying(false);
    }
  });
  useArenaEvent<Signal>("tv:signal", async ({ from, data }) => {
    if (!socket) return;
    if (data.type === "offer" && data.sdp) {
      pc.current?.close();
      const conn = new RTCPeerConnection();
      pc.current = conn;
      conn.onicecandidate = (e) => e.candidate && socket.emit("tv:signal", { to: from, data: { candidate: e.candidate.toJSON() } });
      conn.ontrack = (e) => {
        if (video.current && video.current.srcObject !== e.streams[0]) {
          video.current.srcObject = e.streams[0];
          void video.current.play().then(() => setPlaying(true), () => {});
        }
      };
      await conn.setRemoteDescription({ type: "offer", sdp: data.sdp });
      await conn.setLocalDescription(await conn.createAnswer());
      socket.emit("tv:signal", { to: from, data: { type: "answer", sdp: conn.localDescription!.sdp } });
    } else if (data.candidate && pc.current) await pc.current.addIceCandidate(data.candidate).catch(() => {});
  });

  if (!live) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-3xl bg-black shadow-card">
        <video ref={video} autoPlay playsInline muted={muted} controls={playing} className="aspect-video w-full" aria-label={t("Shared screen")} />
        {!live.live && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div>
              <Users className="mx-auto h-10 w-10 text-white/70" aria-hidden="true" />
              <p className="mt-2 font-bold">{t("Nobody is sharing right now")}</p>
              <p className="text-sm text-white/70">{t("This page starts by itself when the admin shares.")}</p>
            </div>
          </div>
        )}
        {live.live && !playing && (
          <div className="absolute inset-0 grid place-items-center text-white">
            <Loader2 className="h-8 w-8 animate-spin" aria-label={t("Connecting…")} />
          </div>
        )}
        {live.live && playing && muted && (
          <button type="button" onClick={() => setMuted(false)} className="absolute bottom-14 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-slate-900 shadow-lg">
            <Volume2 className="h-4 w-4" aria-hidden="true" /> {t("Tap for sound")}
          </button>
        )}
      </div>
      {live.live && <p className="text-sm text-muted">{t("{name} is sharing a screen.", { name: live.by ?? "Admin" })}</p>}
      <Link href="/tv" className="text-sm font-semibold text-primary">
        ← {t("Back to Nook TV")}
      </Link>
    </div>
  );
}
