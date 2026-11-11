"use client";

// The floating music player: the platform's OWN player in an iframe, with our next / previous / close.
// Desktop: bottom-right corner. Phone: a sheet above the tab bar.

import { ExternalLink, SkipBack, SkipForward, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useMusic } from "./MusicProvider";
import { autoplayUrl, watchForEnd } from "./providers";

export function MusicDock() {
  const { current, queue, next, previous, close } = useMusic();
  const frame = useRef<HTMLIFrameElement>(null);

  // When the song ends, play the next one.
  useEffect(() => {
    if (!current || !frame.current || queue.length < 2) return;
    return watchForEnd(current.provider, frame.current, next);
  }, [current, queue.length, next]);

  if (!current) return null;
  const youtube = current.provider === "youtube";

  return (
    <section
      aria-label="Music player"
      className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 overflow-hidden rounded-2xl border border-border bg-surface-strong/95 shadow-card backdrop-blur-xl lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96"
    >
      <header className="flex items-center gap-2 p-2.5">
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-sm font-semibold">{current.title}</p>
          <p className="truncate text-xs text-muted">
            {current.artist} · {youtube ? "YouTube" : "SoundCloud"}
          </p>
        </div>
        {queue.length > 1 && (
          <>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={previous} aria-label="Previous song">
              <SkipBack className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={next} aria-label="Next song">
              <SkipForward className="h-4 w-4" aria-hidden="true" />
            </Button>
          </>
        )}
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open on ${youtube ? "YouTube" : "SoundCloud"}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-text"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={close} aria-label="Close player">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      {/* key = song id: a new song gets a fresh player */}
      <iframe
        key={current.id}
        ref={frame}
        title={`${current.title} by ${current.artist}`}
        src={autoplayUrl(current.embedUrl, current.provider)}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        className={cn("block w-full border-0", youtube ? "aspect-video" : "h-[120px]")}
      />
    </section>
  );
}
