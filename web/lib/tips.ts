// Focus tips. This file is only imported by Server Components,
// so it never gets sent to the browser as JavaScript.

export type Tip = {
  slug: string;
  title: string;
  summary: string;
  body: string[];
  minutes: number;
};

export const tips: Tip[] = [
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

export function getTip(slug: string): Tip | undefined {
  return tips.find((t) => t.slug === slug);
}
