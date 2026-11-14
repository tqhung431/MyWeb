// Stage 31: the Companion's guide to Nook. One short entry per app (and a few for names, privacy and settings),
// embedded like tips and songs (knowledge.ts), so "how do I…?" and "what can I play with friends?" find the right
// part of Nook. Written for people using Nook, not for the person who runs it: no setup steps, no commands.
// Keep each entry true to the app: when an app changes, change its entry (the index updates by itself).

export type GuideEntry = { id: string; title: string; href: string; text: string };

export const GUIDE: GuideEntry[] = [
  {
    id: "focus-room",
    title: "Focus Room",
    href: "/focus",
    text: "A focus timer with three modes: Focus (25 minutes by default), Break and Long break. The Times button changes the lengths or picks a preset (Classic, Quick, Deep, Flow), and your times follow your name to other devices. Mix calm background sounds (rain, café, waves and more) in the Soundscape. The week chart shows your focus sessions, and achievements unlock as you go. The Tips tab has short focus and rest tips.",
  },
  {
    id: "music",
    title: "Music",
    href: "/music",
    text: "Songs with vocals that people on this Nook added, played by Nook itself. Charts by genre (drill, remix, pop, lofi), likes, a queue with shuffle, repeat and volume, and a mini player that keeps playing while you use other apps. Add songs uploads your own music files. Listen Together (a Music tab) opens a room where everyone hears the same song at the same second.",
  },
  {
    id: "games",
    title: "Games",
    href: "/games",
    text: "All of Nook's games in one app. Quick games: six short games with high scores (Hungry Worm, Silly Pairs and more). Party: Quiz Party, answer fastest against everyone in the room. Together, live with friends: Firecracker Alley (party maze for 2–4, drop firecrackers), Keep the Village (tower defense, alone or with a friend), Night Market Brawl (co-op action for 1–4, works with a gamepad) and Chess (play someone on Nook or Nook itself at 4 levels). Adventures with saves: Cloud Path (a cultivation adventure, turn by turn) and Sproutlings (befriend creatures and wake six shrines). Leaderboards shows every game's best players.",
  },
  {
    id: "messages",
    title: "Messages",
    href: "/messages",
    text: "Private chats between two people. Tap New and pick a name, or tap someone's name in a group chat. You can send pictures (paste, drop or pick one). Tap or right-click your message to copy it, edit it (for 10 minutes; it then shows 'edited') or delete it (Undo for 5 seconds; 'Message deleted' stays in its place). On someone else's message you can Report it to the admin. Chats are kept for 30 days.",
  },
  {
    id: "hobby-hub",
    title: "Hobby Hub",
    href: "/hobby-hub",
    text: "Groups for hobbies, each with a board of posts (comments and likes) and a live group chat with pictures. Anyone can join a group; its posts and chat are only for members, and leaving hides them again. Start your own group with a name and an emoji. Your groups come first and show what's new.",
  },
  {
    id: "habits",
    title: "Habit & Reading Tracker",
    href: "/habits",
    text: "Daily or weekly habits with streaks and an optional daily reminder, and a reading list: add books, log pages, finish them. Progress shows charts of your habits and reading. It keeps working offline and catches up when you're back.",
  },
  {
    id: "watchlist",
    title: "WatchList",
    href: "/watchlist",
    text: "Your list of TV shows and anime: find a title, mark it want to watch, watching, finished or dropped, and give it stars. 'On Nook' shows what's popular with everyone here.",
  },
  {
    id: "nook-tv",
    title: "Nook TV",
    href: "/tv",
    text: "Videos the admin picked from YouTube, on shelves, and live screen shares when the admin shares a screen.",
  },
  {
    id: "names",
    title: "Your name and PIN",
    href: "/account",
    text: "Nook has no email or password: you pick a name and a 4–6 digit PIN. On another phone or computer, sign in with your name and PIN, or with a 6-letter code from Settings → Your devices on a device that's already you. Forgot your PIN? Ask the person who runs Nook for a sign-in code. Ten wrong PINs lock a name for 15 minutes.",
  },
  {
    id: "settings",
    title: "Settings",
    href: "/settings",
    text: "Language (English or Tiếng Việt), light or dark, and six colour themes. Privacy: choose whether your milestones (badges, habit streaks, finished books) appear in Live now. Your devices: see every browser signed in as you, sign one out, sign in another device with a code, or change your PIN.",
  },
  {
    id: "privacy",
    title: "What others see, and what Nook keeps",
    href: "/settings",
    text: "Home's Live now shows only when someone joins Nook, game wins and new songs (and milestones, if that person shares them). Focus sessions, habits, reading, what you watch and listen to stay private. Private chats are only for the two people in them. People not seen for 90 days are removed with their data; chats are kept 30 days. You can delete yourself any time on the You page.",
  },
  {
    id: "companion",
    title: "Free-time Companion",
    href: "/companion",
    text: "That's me: a small AI that runs on the Nook computer, so chats stay here. Ask how anything in Nook works, what to play, for a focus tip, or for a song from Nook's music.",
  },
];
