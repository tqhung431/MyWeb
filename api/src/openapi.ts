// Stage 19: the API described in OpenAPI 3.1, the standard format for HTTP APIs that tools can read
// (docs pages, client generators, API testers like Bruno or Postman).
//
//   GET /api/openapi.json   this document          /developers (on the website)   a readable page made from it
//
// The request rules are not written twice: they are the same Zod schemas the routes use to check input,
// turned into JSON Schema by Zod's own z.toJSONSchema(). tests/openapi.test.ts checks that every route in
// src/routes is listed here, so the document can't quietly fall behind the code.

import { z } from "zod";
import { boardQuery, newScore } from "./routes/arcade.js";
import { periodQuery } from "./routes/arcadeOnline.js";
import { chatBody } from "./routes/companion.js";
import { saveBody } from "./routes/games.js";
import { bookEdits, bookFields, dayBody, habitFields, habitsQuery, pagesBody, statsQuery } from "./routes/habits.js";
import { beforeQuery, commentBody, messageBody, newGroup, postBody } from "./routes/hobby.js";
import { peopleQuery } from "./routes/messages.js";
import { nameBody, preferences } from "./routes/me.js";
import { chartQuery, edits, uploadFields } from "./routes/music.js";
import { newSession, summaryQuery } from "./routes/sessions.js";
import { entryBody, searchQuery } from "./routes/watch.js";

type Who = "anyone" | "guest" | "name"; // anyone · a guest id or a name · a name (cookie) only
type Endpoint = {
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string; // OpenAPI style: /api/songs/{id}
  tag: string;
  summary: string;
  who?: Who;
  query?: z.ZodType;
  body?: z.ZodType;
  multipart?: boolean;
};

// Bodies that every PATCH accepts partially
const partial = (s: z.ZodObject) => s.partial();

export const ENDPOINTS: Endpoint[] = [
  // Health and you
  { method: "get", path: "/health", tag: "System", summary: "Is the API up, with its database and Valkey?" },
  { method: "get", path: "/api/me", tag: "You", summary: "Who you are (a name, or nobody yet)" },
  { method: "post", path: "/api/me", tag: "You", summary: "Pick a name: sets the nook_session cookie and keeps what you did as a guest", body: nameBody },
  { method: "patch", path: "/api/me", tag: "You", summary: "Change your name", who: "name", body: nameBody },
  { method: "delete", path: "/api/me", tag: "You", summary: "Forget me: delete your name and everything linked to it", who: "name" },
  { method: "get", path: "/api/me/data", tag: "You", summary: "What Nook keeps about you (counts), and for how long", who: "name" },
  { method: "put", path: "/api/me/preferences", tag: "You", summary: "Save your settings (focus timer lengths)", who: "name", body: preferences },

  // Chill Corner
  { method: "get", path: "/api/tips", tag: "Chill Corner", summary: "All focus tips" },
  { method: "get", path: "/api/tips/{slug}", tag: "Chill Corner", summary: "One tip" },
  { method: "post", path: "/api/sessions", tag: "Chill Corner", summary: "Save a finished focus session", who: "guest", body: newSession },
  { method: "get", path: "/api/sessions/summary", tag: "Chill Corner", summary: "Your focus minutes per day", who: "guest", query: summaryQuery },
  { method: "get", path: "/api/achievements", tag: "Chill Corner", summary: "Your achievements", who: "guest" },
  { method: "get", path: "/api/activity", tag: "Nook", summary: "What people did lately (the live feed's history)" },

  // Music
  {
    method: "get",
    path: "/api/songs",
    tag: "Music",
    summary: "The charts: songs ranked by plays and likes, with search and paging (total in X-Total-Count)",
    query: chartQuery,
  },
  {
    method: "post",
    path: "/api/songs",
    tag: "Music",
    summary: "Upload a song (multipart: file + these fields)",
    who: "guest",
    body: uploadFields,
    multipart: true,
  },
  { method: "get", path: "/api/songs/upload-limits", tag: "Music", summary: "Largest file and accepted formats" },
  { method: "get", path: "/api/songs/{id}/audio", tag: "Music", summary: "The song file (supports Range requests for seeking)" },
  { method: "get", path: "/api/songs/{id}/artwork", tag: "Music", summary: "Its cover picture" },
  { method: "patch", path: "/api/songs/{id}", tag: "Music", summary: "Fix the title, artist or genre (only whoever added it)", who: "guest", body: edits },
  { method: "delete", path: "/api/songs/{id}", tag: "Music", summary: "Remove a song (only whoever added it)", who: "guest" },
  { method: "post", path: "/api/songs/{id}/play", tag: "Music", summary: "Count a play (once per person per song per 10 minutes)", who: "guest" },
  { method: "put", path: "/api/songs/{id}/like", tag: "Music", summary: "Like a song", who: "guest" },
  { method: "delete", path: "/api/songs/{id}/like", tag: "Music", summary: "Unlike a song", who: "guest" },

  // Mini Arcade
  { method: "get", path: "/api/arcade/games", tag: "Mini Arcade", summary: "The games and their score rules" },
  { method: "get", path: "/api/arcade/me", tag: "Mini Arcade", summary: "Your best score in every game", who: "guest" },
  { method: "get", path: "/api/arcade/scores/{game}", tag: "Mini Arcade", summary: "A game's leaderboard (each person's best)", query: boardQuery },
  {
    method: "post",
    path: "/api/arcade/scores",
    tag: "Mini Arcade",
    summary: "Save a score: tells you if it's a new best and your rank",
    who: "guest",
    body: newScore,
  },

  // Arcade Online
  { method: "get", path: "/api/arcade-online/rooms", tag: "Arcade Online", summary: "Open Quiz Party rooms (playing happens over Socket.IO)" },
  { method: "get", path: "/api/arcade-online/categories", tag: "Arcade Online", summary: "Quiz categories" },
  { method: "get", path: "/api/arcade-online/leaderboard", tag: "Arcade Online", summary: "Most wins", query: periodQuery },

  // Companion
  { method: "get", path: "/api/companion/status", tag: "Companion", summary: "Is the local AI (Ollama) ready?" },
  {
    method: "post",
    path: "/api/companion/chat",
    tag: "Companion",
    summary: "Ask the Companion: the answer streams back as Server-Sent Events",
    who: "guest",
    body: chatBody,
  },

  // Hobby Hub
  { method: "get", path: "/api/hobby/groups", tag: "Hobby Hub", summary: "All groups, with members, posts and last activity" },
  { method: "post", path: "/api/hobby/groups", tag: "Hobby Hub", summary: "Start a group", who: "name", body: newGroup },
  { method: "get", path: "/api/hobby/groups/{slug}", tag: "Hobby Hub", summary: "One group" },
  { method: "delete", path: "/api/hobby/groups/{slug}", tag: "Hobby Hub", summary: "Delete a group you started", who: "name" },
  { method: "put", path: "/api/hobby/groups/{slug}/membership", tag: "Hobby Hub", summary: "Join a group", who: "name" },
  { method: "delete", path: "/api/hobby/groups/{slug}/membership", tag: "Hobby Hub", summary: "Leave a group", who: "name" },
  { method: "put", path: "/api/hobby/groups/{slug}/read", tag: "Hobby Hub", summary: "Mark everything in a group as read", who: "name" },
  { method: "get", path: "/api/hobby/groups/{slug}/posts", tag: "Hobby Hub", summary: "The board, newest first, 20 at a time", query: beforeQuery },
  { method: "post", path: "/api/hobby/groups/{slug}/posts", tag: "Hobby Hub", summary: "Write a post", who: "name", body: postBody },
  { method: "delete", path: "/api/hobby/posts/{id}", tag: "Hobby Hub", summary: "Delete your post", who: "name" },
  { method: "put", path: "/api/hobby/posts/{id}/like", tag: "Hobby Hub", summary: "Like a post", who: "name" },
  { method: "delete", path: "/api/hobby/posts/{id}/like", tag: "Hobby Hub", summary: "Unlike a post", who: "name" },
  { method: "get", path: "/api/hobby/posts/{id}/comments", tag: "Hobby Hub", summary: "A post's comments, oldest first" },
  { method: "post", path: "/api/hobby/posts/{id}/comments", tag: "Hobby Hub", summary: "Comment on a post", who: "name", body: commentBody },
  { method: "delete", path: "/api/hobby/comments/{id}", tag: "Hobby Hub", summary: "Delete your comment", who: "name" },
  { method: "get", path: "/api/hobby/groups/{slug}/messages", tag: "Hobby Hub", summary: "Chat history, 50 at a time", query: beforeQuery },
  {
    method: "post",
    path: "/api/hobby/groups/{slug}/messages",
    tag: "Hobby Hub",
    summary: "Send a chat message (everyone in the room sees it at once)",
    who: "name",
    body: messageBody,
  },
  { method: "delete", path: "/api/hobby/messages/{id}", tag: "Hobby Hub", summary: "Delete your chat message", who: "name" },
  { method: "get", path: "/api/hobby/unread", tag: "Hobby Hub", summary: "Unread private messages and group posts/messages (the badge)" },
  { method: "get", path: "/api/hobby/people", tag: "Hobby Hub", summary: "People with a name, to start a private chat with", who: "name", query: peopleQuery },
  { method: "get", path: "/api/hobby/dms", tag: "Hobby Hub", summary: "Your private chats, newest first, with unread counts", who: "name" },
  { method: "get", path: "/api/hobby/dms/{userId}", tag: "Hobby Hub", summary: "One private chat, 50 messages at a time", who: "name", query: beforeQuery },
  { method: "post", path: "/api/hobby/dms/{userId}", tag: "Hobby Hub", summary: "Send a private message (words, a picture, or both)", who: "name", body: messageBody },
  { method: "put", path: "/api/hobby/dms/{userId}/read", tag: "Hobby Hub", summary: "Mark a private chat as read", who: "name" },
  { method: "delete", path: "/api/hobby/dms/messages/{id}", tag: "Hobby Hub", summary: "Delete your private message", who: "name" },
  { method: "post", path: "/api/hobby/images", tag: "Hobby Hub", summary: "Upload a picture for a chat (multipart: file; JPEG, PNG, WebP or GIF up to 5 MB)", who: "name" },
  { method: "get", path: "/api/hobby/images/{id}", tag: "Hobby Hub", summary: "A chat picture (group chat: anyone; private chat: the two people)" },

  // WatchList
  { method: "get", path: "/api/watch/search", tag: "WatchList", summary: "Search TV shows (TVmaze) and anime (Jikan)", query: searchQuery },
  { method: "get", path: "/api/watch/list", tag: "WatchList", summary: "Your list", who: "name" },
  {
    method: "put",
    path: "/api/watch/list/{source}/{externalId}",
    tag: "WatchList",
    summary: "Add a title to your list, or update its status, stars and note",
    who: "name",
    body: entryBody,
  },
  { method: "delete", path: "/api/watch/list/{titleId}", tag: "WatchList", summary: "Remove a title from your list", who: "name" },
  { method: "get", path: "/api/watch/popular", tag: "WatchList", summary: "What people on Nook are watching" },
  { method: "get", path: "/api/watch/titles/{id}", tag: "WatchList", summary: "One title, with everyone's ratings and notes" },

  // Habit & Reading Tracker (days are dates in your time zone: send X-Time-Zone)
  {
    method: "get",
    path: "/api/habits",
    tag: "Habits & Reading",
    summary: "Your habits: the days you did them, streaks, this week",
    who: "name",
    query: habitsQuery,
  },
  { method: "post", path: "/api/habits", tag: "Habits & Reading", summary: "Add a habit", who: "name", body: habitFields },
  { method: "patch", path: "/api/habits/{id}", tag: "Habits & Reading", summary: "Change a habit", who: "name", body: partial(habitFields) },
  { method: "delete", path: "/api/habits/{id}", tag: "Habits & Reading", summary: "Delete a habit", who: "name" },
  {
    method: "put",
    path: "/api/habits/{id}/days/{day}",
    tag: "Habits & Reading",
    summary: "Tick or untick a day (today, or up to 30 days back)",
    who: "name",
    body: dayBody,
  },
  { method: "get", path: "/api/books", tag: "Habits & Reading", summary: "Your books", who: "name" },
  { method: "post", path: "/api/books", tag: "Habits & Reading", summary: "Add a book", who: "name", body: bookFields },
  { method: "patch", path: "/api/books/{id}", tag: "Habits & Reading", summary: "Change a book, or where you are in it", who: "name", body: bookEdits },
  { method: "delete", path: "/api/books/{id}", tag: "Habits & Reading", summary: "Delete a book", who: "name" },
  { method: "post", path: "/api/books/{id}/pages", tag: "Habits & Reading", summary: "Log pages read", who: "name", body: pagesBody },
  { method: "get", path: "/api/books/stats", tag: "Habits & Reading", summary: "Pages per day, this week, this year", who: "name", query: statsQuery },

  // Nook Games
  { method: "get", path: "/api/games/saves", tag: "Nook Games", summary: "Your saved games", who: "name" },
  { method: "get", path: "/api/games/saves/{game}", tag: "Nook Games", summary: "One saved game", who: "name" },
  { method: "put", path: "/api/games/saves/{game}", tag: "Nook Games", summary: "Save a game (up to 200 KB of JSON)", who: "name", body: saveBody },
  { method: "delete", path: "/api/games/saves/{game}", tag: "Nook Games", summary: "Delete a saved game", who: "name" },
  { method: "get", path: "/api/games/leaderboard/{game}", tag: "Nook Games", summary: "Bảng phong vân: the top 20 by level, then kills" },
];

const WHO_TEXT: Record<Who, string> = {
  anyone: "",
  guest: "Needs a name (cookie) or a guest id (X-Client-Id header).",
  name: "Needs a name (the nook_session cookie).",
};

// A Zod schema → JSON Schema, as the request looks before defaults are filled in
const schemaOf = (s: z.ZodType) => {
  const json = z.toJSONSchema(s, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
};

// The query string, one parameter per property
function queryParams(s: z.ZodType) {
  const json = schemaOf(s) as { properties?: Record<string, object>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([name, schema]) => ({ name, in: "query", required: json.required?.includes(name) ?? false, schema }));
}

export function openApiDocument(version = "19") {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const pathParams = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
    const who = e.who ?? "anyone";
    paths[e.path] ??= {};
    paths[e.path][e.method] = {
      tags: [e.tag],
      summary: e.summary,
      ...(WHO_TEXT[who] ? { description: WHO_TEXT[who] } : {}),
      ...(who === "name" ? { security: [{ session: [] }] } : who === "guest" ? { security: [{ session: [] }, { guest: [] }] } : {}),
      parameters: [...pathParams, ...(e.query ? queryParams(e.query) : [])],
      ...(e.body
        ? { requestBody: { required: true, content: { [e.multipart ? "multipart/form-data" : "application/json"]: { schema: schemaOf(e.body) } } } }
        : {}),
      responses: {
        "200": { description: "OK (JSON)" },
        ...(e.body || e.query ? { "400": { description: "The input broke a rule: { error, issues }" } } : {}),
        ...(who === "name" ? { "401": { description: "Pick a name first" } } : {}),
        "429": { description: "Too many requests: slow down" },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Nook API",
      version,
      description:
        "The API behind Nook, a self-hosted hub of free-time apps. Errors are JSON: { error: string }. Real-time updates use Socket.IO on /socket.io.",
      license: { name: "MIT", identifier: "MIT" },
    },
    servers: [{ url: "/", description: "This Nook" }],
    components: {
      securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: "nook_session", description: "Set by POST /api/me when you pick a name" },
        guest: { type: "apiKey", in: "header", name: "X-Client-Id", description: "A random UUID the browser keeps, for guests" },
      },
    },
    tags: [...new Set(ENDPOINTS.map((e) => e.tag))].map((name) => ({ name })),
    paths,
  };
}
