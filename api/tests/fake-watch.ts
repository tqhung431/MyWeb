// A tiny fake of TVmaze and Jikan, so WatchList tests don't depend on the internet.
// TVmaze answers are a real (trimmed) sample (fixtures/tvmaze-friends.json); Jikan's follow its v4 format.

import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";

const friends = JSON.parse(readFileSync(new URL("./fixtures/tvmaze-friends.json", import.meta.url), "utf8")) as { show: { id: number } }[];

export const frieren = {
  mal_id: 52991,
  url: "https://myanimelist.net/anime/52991/Sousou_no_Frieren",
  title: "Sousou no Frieren",
  title_english: "Frieren: Beyond Journey's End",
  type: "TV",
  episodes: 28,
  year: 2023,
  aired: { from: "2023-09-29T00:00:00+00:00" },
  score: 9.3,
  synopsis: "During their decade-long quest to defeat the Demon King…\n\n[Written by MAL Rewrite]",
  genres: [{ name: "Adventure" }, { name: "Drama" }, { name: "Fantasy" }],
  images: { jpg: { image_url: "https://cdn.myanimelist.net/images/anime/1015/138006.jpg" } },
};

export type FakeWatch = Server & { calls: string[]; animeDown: boolean };

export function startFakeWatch(port = 4995): Promise<FakeWatch> {
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://x");
    fake.calls.push(url.pathname + url.search);
    const json = (status: number, body: unknown) => res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
    if (url.pathname === "/tvmaze/search/shows") return json(200, url.searchParams.get("q")?.includes("friends") ? friends : []);
    const show = url.pathname.match(/^\/tvmaze\/shows\/(\d+)$/);
    if (show) {
      const found = friends.find((r) => r.show.id === Number(show[1]));
      return found ? json(200, found.show) : json(404, {});
    }
    if (url.pathname.startsWith("/jikan/") && fake.animeDown) return json(503, { status: 503 });
    if (url.pathname === "/jikan/anime") return json(200, { data: url.searchParams.get("q")?.includes("frieren") ? [frieren] : [] });
    if (url.pathname === `/jikan/anime/${frieren.mal_id}`) return json(200, { data: frieren });
    if (url.pathname.startsWith("/jikan/anime/")) return json(404, { status: 404 });
    json(404, {});
  });
  const fake = Object.assign(server, { calls: [] as string[], animeDown: false });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(fake)));
}
