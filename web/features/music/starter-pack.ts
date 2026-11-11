// The 12 Creative Commons songs WITH VOCALS suggested to start the charts (3 per genre),
// chosen by their ratings on ccMixter. Same list as api/seed/starter-pack.json.
// Download each from its ccMixter page, then upload the files: Nook recognises them
// by file name and fills in the credit and licence.

import type { Genre } from "@/lib/api/music";

export const STARTER_PACK: { title: string; artist: string; genre: Genre; license: string; page: string }[] = [
  { title: "Go time", artist: "FORENSIC", genre: "drill", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/4nsic/28500" },
  { title: "Demons got ahold of me", artist: "FORENSIC", genre: "drill", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/4nsic/46009" },
  { title: "It's Only Me", artist: "Donnie Ozone", genre: "drill", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/donnieozone/52987" },
  { title: "Outside Poolside", artist: "Lasswell", genre: "remix", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/lazztunes07/27051" },
  { title: "Broken (DURDEN version)", artist: "DURDEN feat. Amelia June", genre: "remix", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/DURDEN/15248" },
  { title: "A Scene Before Fire", artist: "Jeris", genre: "remix", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/VJ_Memes/46392" },
  { title: "I Wonder If God Was Sleeping", artist: "Scott Altham", genre: "pop", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/scottaltham/18129" },
  { title: "too quiet", artist: "oldDog feat. narva9", genre: "pop", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/oldDog/17286" },
  { title: "Unsaid", artist: "7OOP3D", genre: "pop", license: "CC BY-NC 3.0", page: "https://ccmixter.org/files/7OOP3D/39174" },
  { title: "Brilliant Daze", artist: "Pat Chilla The Beat Gorilla", genre: "lofi", license: "CC BY-NC 2.5", page: "https://ccmixter.org/files/beatgorilla/1838" },
  { title: "Babylon Bring Me Down", artist: "spinningmerkaba", genre: "lofi", license: "CC BY-NC 2.5", page: "https://ccmixter.org/files/jlbrock44/6134" },
  { title: "ophelia's next goodbye", artist: "audiomesh", genre: "lofi", license: "CC BY 2.5", page: "https://ccmixter.org/files/audiomesh/6422" },
];
