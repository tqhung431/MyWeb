// Puts the starting tips (and Stage 11: starter Hobby Hub groups) into the database.
// Safe to run again: existing tips are updated, existing groups are left alone.

import { sql } from "drizzle-orm";
import { db, pool } from "./client.js";
import { hobbyGroups, tips } from "./schema.js";
import { invalidate } from "../valkey/cache.js";
import { valkey, waitForValkey } from "../valkey/client.js";

export const seedTips = [
  {
    slug: "one-thing",
    title: "Pick one thing",
    summary: "Write down the single task for this session before you press Start.",
    body: [
      "Before the timer starts, write one short sentence: what will be done when it rings?",
      "If a new idea pops up, add it to a list for later and come back to the task.",
    ],
    minutes: 1,
  },
  {
    slug: "real-breaks",
    title: "Take real breaks",
    summary: "Stand up and look away from the screen during the 5-minute break.",
    body: [
      "A break works best when it's different from the work: stand, stretch, drink water.",
      "Scrolling your phone usually keeps your brain busy, so it doesn't feel like a break.",
    ],
    minutes: 5,
  },
  {
    slug: "sound-choice",
    title: "Choose a steady sound",
    summary: "Rain and waves have no melody, which makes them easy to ignore while reading.",
    body: [
      "Music with lyrics competes with words you're reading or writing.",
      "Try Rain or Waves for reading, and Lo-fi keys for routine tasks.",
    ],
    minutes: 1,
  },
  {
    slug: "four-rounds",
    title: "Long break after four",
    summary: "After four focus sessions, take a 15-minute long break.",
    body: [
      "Four rounds of 25 minutes is close to two hours of deep work.",
      "Use the Long 15 mode, then decide whether to keep going.",
    ],
    minutes: 15,
  },
];

export const seedGroups = [
  { slug: "gaming", name: "Gaming", emoji: "🎮", description: "What are you playing? Tips, screenshots and who's up for a match." },
  { slug: "cooking", name: "Cooking", emoji: "🍳", description: "Recipes, kitchen wins and spectacular fails." },
  { slug: "music", name: "Music", emoji: "🎵", description: "Songs on repeat, concerts and playing instruments." },
  { slug: "books", name: "Books", emoji: "📚", description: "What you're reading and what to read next." },
  { slug: "movies-anime", name: "Movies & Anime", emoji: "🎬", description: "Watch lists, reviews (spoiler warnings, please) and recommendations." },
  { slug: "sports", name: "Sports & Fitness", emoji: "⚽", description: "Matches, workouts, runs and walks." },
];

export async function seed() {
  await db.insert(hobbyGroups).values(seedGroups).onConflictDoNothing({ target: hobbyGroups.slug });
  await db
    .insert(tips)
    .values(seedTips)
    .onConflictDoUpdate({
      target: tips.slug,
      set: {
        title: sql`excluded.title`,
        summary: sql`excluded.summary`,
        body: sql`excluded.body`,
        minutes: sql`excluded.minutes`,
      },
    });
  // The tips changed, so cached copies are out of date: delete them.
  await waitForValkey();
  await invalidate("tips:list", ...seedTips.map((t) => `tips:${t.slug}`));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seed();
  console.log(`Seeded ${seedTips.length} tips.`);
  await pool.end();
  valkey.disconnect();
}
