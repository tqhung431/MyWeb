// Stage 13: Habit & Reading Tracker.

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { addDays, clockIn, countInWeek, dayStreak, isDay, todayIn, weekStart, weekStreak } from "../src/habits/days.js";
import { sendReminders } from "../src/jobs/reminders.js";
import { closeAll, resetDatabase } from "./helpers.js";

const app = createApp();
beforeEach(resetDatabase);
afterAll(closeAll);

const TZ = "Asia/Ho_Chi_Minh";
const today = () => todayIn(TZ);

async function person(name: string) {
  const agent = request.agent(app);
  await agent.post("/api/me").send({ name });
  return agent;
}

describe("day maths", () => {
  it("knows today in your time zone, and Mondays", () => {
    const at = new Date("2026-11-10T20:00:00Z"); // 03:00 on the 11th in Hanoi, still the 10th in London
    expect(todayIn("Asia/Ho_Chi_Minh", at)).toBe("2026-11-11");
    expect(todayIn("Europe/London", at)).toBe("2026-11-10");
    expect(clockIn("Asia/Ho_Chi_Minh", at)).toBe("03:00");
    expect(weekStart("2026-11-11")).toBe("2026-11-09"); // a Wednesday → its Monday
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(isDay("2026-02-30")).toBe(false);
  });

  it("counts streaks; today not done yet doesn't break them", () => {
    const done = new Set(["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(dayStreak(done, "2026-11-10")).toBe(3);
    expect(dayStreak(done, "2026-11-11")).toBe(3); // still time today
    expect(dayStreak(done, "2026-11-12")).toBe(0); // missed yesterday
  });

  it("counts weeks that met a 'N days a week' goal", () => {
    // 3 days in the week of Nov 2, 3 days in the week of Nov 9 (so far)
    const done = new Set(["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11"]);
    expect(countInWeek(done, "2026-11-11")).toBe(3);
    expect(weekStreak(done, "2026-11-11", 3)).toBe(2);
    expect(weekStreak(done, "2026-11-11", 4)).toBe(0);
    expect(weekStreak(new Set(["2026-11-02", "2026-11-04", "2026-11-06"]), "2026-11-10", 3)).toBe(1); // this week not met yet: no break
  });
});

describe("habits", () => {
  it("adds a habit, ticks days and keeps the streak", async () => {
    const linh = await person("Linh");
    const created = await linh.post("/api/habits").set("X-Time-Zone", TZ).send({ name: "Read 20 min", emoji: "📚", reminderTime: "21:00" });
    expect(created.status).toBe(201);
    const id = created.body.id;

    for (const back of [2, 1, 0]) {
      const r = await linh
        .put(`/api/habits/${id}/days/${addDays(today(), -back)}`)
        .set("X-Time-Zone", TZ)
        .send({ done: true });
      expect(r.status).toBe(200);
    }
    const list = await linh.get("/api/habits").set("X-Time-Zone", TZ);
    expect(list.body.today).toBe(today());
    expect(list.body.habits[0]).toMatchObject({ name: "Read 20 min", doneToday: true, streak: { count: 3, unit: "day" }, reminderTime: "21:00" });
    expect(list.body.habits[0].days).toHaveLength(3);

    const undo = await linh.put(`/api/habits/${id}/days/${today()}`).set("X-Time-Zone", TZ).send({ done: false });
    expect(undo.body.streak).toEqual({ count: 2, unit: "day" });
  });

  it("is private, and refuses far-away days and bad input", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    const { body: h } = await linh.post("/api/habits").send({ name: "Run", emoji: "🏃", perWeek: 3 });
    expect((await mai.put(`/api/habits/${h.id}/days/${todayIn("UTC")}`).send({ done: true })).status).toBe(404);
    expect((await mai.get("/api/habits")).body.habits).toEqual([]);
    expect((await linh.put(`/api/habits/${h.id}/days/${addDays(todayIn("UTC"), 5)}`).send({ done: true })).status).toBe(400);
    expect((await linh.put(`/api/habits/${h.id}/days/2020-01-01`).send({ done: true })).status).toBe(400);
    expect((await linh.post("/api/habits").send({ name: "x", emoji: "abc" })).status).toBe(400);
    expect((await linh.post("/api/habits").send({ name: "x", emoji: "🏃", reminderTime: "25:00" })).status).toBe(400);
    expect((await request(app).get("/api/habits")).status).toBe(401);
  });
});

describe("reminders", () => {
  it("reminds once, at the time, only if not done yet", async () => {
    const linh = await person("Linh");
    const at = new Date("2026-11-11T13:00:00Z"); // 20:00 in Hanoi
    const { body: read } = await linh.post("/api/habits").set("X-Time-Zone", TZ).send({ name: "Read", emoji: "📚", reminderTime: "20:00" });
    const { body: walk } = await linh.post("/api/habits").set("X-Time-Zone", TZ).send({ name: "Walk", emoji: "🚶", reminderTime: "20:00" });
    await linh.post("/api/habits").set("X-Time-Zone", TZ).send({ name: "Later", emoji: "🌙", reminderTime: "22:00" });
    await pool.query("insert into habit_days (habit_id, day) values ($1, '2026-11-11')", [walk.id]); // walked already

    expect(await sendReminders(at)).toEqual({ sent: 1 }); // only "Read"
    expect(await sendReminders(new Date(at.getTime() + 60_000))).toEqual({ sent: 0 }); // not twice
    const { rows } = await pool.query("select last_reminded_on::text as d from habits where id = $1", [read.id]);
    expect(rows[0].d).toBe("2026-11-11");
  });
});

describe("reading", () => {
  it("logs pages, moves your place, finishes the book and adds up the stats", async () => {
    const linh = await person("Linh");
    const { body: book } = await linh.post("/api/books").set("X-Time-Zone", TZ).send({ title: "Dế Mèn phiêu lưu ký", author: "Tô Hoài", totalPages: 120 });
    expect(book).toMatchObject({ status: "reading", currentPage: 0, startedOn: today() });

    await linh.post(`/api/books/${book.id}/pages`).set("X-Time-Zone", TZ).send({ pages: 30 });
    const twice = await linh.post(`/api/books/${book.id}/pages`).set("X-Time-Zone", TZ).send({ pages: 20 });
    expect(twice.body.currentPage).toBe(50);
    await linh
      .post(`/api/books/${book.id}/pages`)
      .set("X-Time-Zone", TZ)
      .send({ pages: 40, day: addDays(today(), -1) });
    const done = await linh.post(`/api/books/${book.id}/pages`).set("X-Time-Zone", TZ).send({ pages: 100 });
    expect(done.body).toMatchObject({ currentPage: 120, status: "finished", finishedOn: today() });

    const stats = await linh.get("/api/books/stats?days=7").set("X-Time-Zone", TZ);
    expect(stats.body.series).toHaveLength(7);
    expect(stats.body.series.at(-1)).toEqual({ day: today(), pages: 150 });
    expect(stats.body.series.at(-2).pages).toBe(40);
    expect(stats.body).toMatchObject({ week: 190, finishedThisYear: 1 });
  });

  it("keeps books private", async () => {
    const linh = await person("Linh");
    const mai = await person("Mai");
    const { body: book } = await linh.post("/api/books").send({ title: "Secret diary" });
    expect((await mai.get("/api/books")).body).toEqual([]);
    expect((await mai.post(`/api/books/${book.id}/pages`).send({ pages: 5 })).status).toBe(404);
    expect((await mai.delete(`/api/books/${book.id}`)).status).toBe(404);
  });
});
