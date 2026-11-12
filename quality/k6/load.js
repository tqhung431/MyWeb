// Stage 19: a load test with k6 (https://k6.io, AGPL-3.0 tool, not shipped with Nook).
// "Virtual users" (VUs) act like people on the home network: open the music charts, look at tips and
// leaderboards, play a Mini Arcade round and save the score. The test fails if Nook gets slow or errors.
//
//   k6 run quality/k6/load.js                                  (API on http://localhost:4000)
//   BASE_URL=https://localhost k6 run --insecure-skip-tls-verify quality/k6/load.js    (through Caddy)
//
// A home network rarely has more than ~10 people at once; we ramp to 50 to see where the limits are.
// WRITES=1 k6 run …   also save Mini Arcade scores. Off by default: on your real Nook that would fill the
//                     leaderboards with fake guests. CI turns it on (its database is thrown away afterwards).
// STRESS=1 k6 run …   the same 50 people, but with no pauses: as fast as Nook can answer (how far can it go?)
import http from "k6/http";
import { check, sleep as pause } from "k6";

const sleep = (s) => (__ENV.STRESS ? null : pause(s));

const BASE = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const GAMES = ["worm", "pairs", "bonk", "pancakes", "reflex", "odd"];

export const options = {
  scenarios: {
    people: {
      executor: "ramping-vus",
      stages: [
        { duration: "15s", target: 10 }, // a normal evening
        { duration: "30s", target: 50 }, // a party
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // under 1% errors
    http_req_duration: ["p(95)<300"], // 95% of requests in under 0.3 s
    "http_req_duration{kind:write}": ["p(95)<500"],
  },
};

// Every virtual user is a guest with their own id, like a fresh browser
const uuid = () => "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

export default function () {
  const headers = { "X-Client-Id": uuid(), "Content-Type": "application/json" };
  const read = { headers, tags: { kind: "read" } };

  check(http.get(`${BASE}/api/tips`, read), { "tips 200": (r) => r.status === 200 });
  check(http.get(`${BASE}/api/songs?period=week&limit=100`, read), { "charts 200": (r) => r.status === 200 });
  sleep(1 + Math.random() * 2); // reading the page

  const game = GAMES[Math.floor(Math.random() * GAMES.length)];
  check(http.get(`${BASE}/api/arcade/scores/${game}?period=week`, read), { "leaderboard 200": (r) => r.status === 200 });
  sleep(2 + Math.random() * 3); // playing a round

  if (__ENV.WRITES === "1") {
    // A possible score for each game (the API refuses impossible ones, e.g. Silly Pairs takes at least 8 moves)
    const score =
      game === "reflex" ? 200 + Math.floor(Math.random() * 300) : game === "pairs" ? 8 + Math.floor(Math.random() * 30) : Math.floor(Math.random() * 40);
    const saved = http.post(`${BASE}/api/arcade/scores`, JSON.stringify({ game, score }), { headers, tags: { kind: "write" } });
    check(saved, { "score saved": (r) => r.status === 200 || r.status === 201 });
  }
  sleep(1);
}
