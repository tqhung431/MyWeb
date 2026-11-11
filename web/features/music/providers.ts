// Talking to the SoundCloud and YouTube players inside their <iframe>s, with their OFFICIAL
// scripts, only to know when a song ends (so the next one can start). Loaded on first use.

declare global {
  interface Window {
    SC?: { Widget: ((el: HTMLIFrameElement) => { bind: (event: string, fn: () => void) => void; unbind: (event: string) => void }) & { Events: { FINISH: string } } };
    YT?: { Player: new (el: HTMLIFrameElement, opts: { events: { onStateChange: (e: { data: number }) => void } }) => { destroy: () => void } };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const loading = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  if (!loading.has(src)) {
    loading.set(
      src,
      new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => {
          loading.delete(src); // allow a retry later
          reject(new Error(`Couldn't load ${src}`));
        };
        document.head.appendChild(s);
      }),
    );
  }
  return loading.get(src)!;
}

let youTubeReady: Promise<void> | null = null;
function loadYouTube(): Promise<void> {
  youTubeReady ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      resolve();
    };
    loadScript("https://www.youtube.com/iframe_api").catch((e) => {
      youTubeReady = null;
      reject(e);
    });
  });
  return youTubeReady;
}

// Call onEnd when the song in this iframe finishes. Returns a clean-up function.
// If the platform's script can't load, music still plays; it just won't auto-advance.
export function watchForEnd(provider: "soundcloud" | "youtube", iframe: HTMLIFrameElement, onEnd: () => void): () => void {
  let cleanup = () => {};
  let cancelled = false;

  if (provider === "soundcloud") {
    loadScript("https://w.soundcloud.com/player/api.js")
      .then(() => {
        if (cancelled || !window.SC) return;
        const widget = window.SC.Widget(iframe);
        widget.bind(window.SC.Widget.Events.FINISH, onEnd);
        cleanup = () => widget.unbind(window.SC!.Widget.Events.FINISH);
      })
      .catch(() => {});
  } else {
    loadYouTube()
      .then(() => {
        if (cancelled || !window.YT) return;
        const player = new window.YT.Player(iframe, {
          events: { onStateChange: (e) => e.data === 0 && onEnd() }, // 0 = ended
        });
        cleanup = () => player.destroy();
      })
      .catch(() => {});
  }

  return () => {
    cancelled = true;
    cleanup();
  };
}

// The player address, asking it to start playing right away (you just pressed play).
export function autoplayUrl(embedUrl: string, provider: "soundcloud" | "youtube"): string {
  const u = new URL(embedUrl);
  if (provider === "soundcloud") u.searchParams.set("auto_play", "true");
  else {
    u.searchParams.set("autoplay", "1");
    u.searchParams.set("origin", window.location.origin); // needed by YouTube's script
  }
  return u.toString();
}
