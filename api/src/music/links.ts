// Turning a pasted link into a song we can embed.
//
// 1. Recognise the link: SoundCloud or YouTube only (anything else is refused).
// 2. Ask the platform's official oEmbed service about it. That confirms the song exists, that its
//    owner allows embedding, and gives us the title, artist and cover picture.
// 3. Build the address of the platform's OWN player. We never download or store the audio:
//    it streams from SoundCloud/YouTube, so the artist keeps the rights and gets the plays.

import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";

export type Provider = "soundcloud" | "youtube";
export type LinkInfo = { provider: Provider; url: string; videoId?: string };
export type SongDetails = { provider: Provider; url: string; embedUrl: string; title: string; artist: string; artworkUrl: string | null };

const SOUNDCLOUD_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"]);
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

export function parseLink(input: string): LinkInfo {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new HttpError(400, "That doesn't look like a link");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new HttpError(400, "That doesn't look like a link");
  const host = u.hostname.toLowerCase();

  if (SOUNDCLOUD_HOSTS.has(host)) {
    const path = u.pathname.replace(/\/+$/, "");
    if (path.split("/").filter(Boolean).length < (host === "on.soundcloud.com" ? 1 : 2)) {
      throw new HttpError(400, "Paste the link of one SoundCloud song or playlist, not a profile");
    }
    // Clean link: no tracking parameters (?si=…, ?utm_…), always the main site
    return { provider: "soundcloud", url: `https://${host === "on.soundcloud.com" ? host : "soundcloud.com"}${path}` };
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/")
          ? u.pathname.split("/")[2]
          : u.searchParams.get("v");
    if (!id || !/^[\w-]{11}$/.test(id)) throw new HttpError(400, "Paste the link of one YouTube video");
    return { provider: "youtube", url: `https://www.youtube.com/watch?v=${id}`, videoId: id };
  }

  throw new HttpError(400, "Only SoundCloud and YouTube links can be added");
}

type OEmbed = { title?: string; author_name?: string; thumbnail_url?: string; html?: string };

export async function lookUp(link: LinkInfo): Promise<SongDetails> {
  const base = link.provider === "soundcloud" ? config.SOUNDCLOUD_OEMBED_URL : config.YOUTUBE_OEMBED_URL;
  let res: Response;
  try {
    res = await fetch(`${base}?format=json&url=${encodeURIComponent(link.url)}`, { signal: AbortSignal.timeout(6000) });
  } catch {
    throw new HttpError(502, `Couldn't reach ${link.provider === "soundcloud" ? "SoundCloud" : "YouTube"}. Try again in a moment.`);
  }
  if (res.status === 404) throw new HttpError(404, "That song wasn't found. Is the link right, and is the song public?");
  if (res.status === 401 || res.status === 403) {
    throw new HttpError(422, "The owner of that song doesn't allow it to be played on other sites");
  }
  if (!res.ok) throw new HttpError(502, "The music site gave an unexpected answer. Try again later.");
  const data = (await res.json()) as OEmbed;

  const artist = (data.author_name ?? "Unknown artist").trim().slice(0, 120);
  // SoundCloud titles look like "Song by Artist"; keep just "Song".
  let title = (data.title ?? "Untitled").trim();
  if (title.endsWith(` by ${artist}`)) title = title.slice(0, -` by ${artist}`.length);

  return {
    provider: link.provider,
    url: link.url,
    embedUrl: link.provider === "youtube" ? youTubePlayer(link.videoId!) : soundCloudPlayer(data.html, link.url),
    title: title.slice(0, 200),
    artist,
    artworkUrl: safeHttps(data.thumbnail_url),
  };
}

// YouTube's privacy-enhanced player (no cookies until you press play); enablejsapi lets us
// notice when a song ends, to play the next one.
function youTubePlayer(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0`;
}

// Take the player address from SoundCloud's answer, but only if it really is SoundCloud's player.
// (We never put an address we haven't checked into an <iframe>.)
function soundCloudPlayer(html: string | undefined, url: string): string {
  const src = html?.match(/src="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  if (src) {
    try {
      const u = new URL(src);
      if (u.protocol === "https:" && u.hostname === "w.soundcloud.com" && u.pathname.startsWith("/player")) {
        u.searchParams.set("visual", "false");
        u.searchParams.set("show_comments", "false");
        return u.toString();
      }
    } catch {
      // fall through
    }
  }
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&visual=false&show_comments=false`;
}

function safeHttps(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
