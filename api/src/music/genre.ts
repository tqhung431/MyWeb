// Guessing a song's genre, so nobody has to choose one when adding a song.
//
// Clues, strongest first:
//   1. the genre written inside the file (ID3 tag), e.g. "Hip-Hop", "Dance", "Chillout"
//   2. words in the title, e.g. "(Vinahouse Remix)", "lofi", "slowed + reverb"
// No clue → "pop". The person who added it can still change it.

export const GENRES = ["drill", "remix", "pop", "lofi"] as const;
export type Genre = (typeof GENRES)[number];

// Checked in this order: "lofi remix" is lofi, "drill remix" is drill.
const RULES: { genre: Genre; words: RegExp }[] = [
  { genre: "lofi", words: /lo-?fi|chill|downtempo|ambient|slowed|reverb|acoustic|trip.?hop|sleep|study/i },
  { genre: "drill", words: /drill|rap\b|hip.?hop|trap|grime|boom.?bap/i },
  { genre: "remix", words: /remix|vinahouse|dance|edm|house|techno|electro|club|bass|dubstep|\bmix\b|nonstop/i },
  { genre: "pop", words: /pop|ballad|r&b|rnb|soul|indie|rock|v-?pop|k-?pop/i },
];

const match = (text: string) => RULES.find((r) => r.words.test(text))?.genre;

export function detectGenre({ tags = [], title = "" }: { tags?: string[]; title?: string }): Genre {
  return match(tags.join(" ")) ?? match(title) ?? "pop";
}
