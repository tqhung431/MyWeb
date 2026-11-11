// Quiz Party's questions (Stage 14). Written for Nook. `answer` is the index of the right choice;
// it never leaves the server until everyone has answered or time is up.

export type Category = "general" | "science" | "music" | "screen" | "food";
export type Question = { category: Category; text: string; choices: [string, string, string, string]; answer: 0 | 1 | 2 | 3 };

export const CATEGORY_LABEL: Record<Category, string> = {
  general: "General knowledge",
  science: "Science & nature",
  music: "Music",
  screen: "Movies, TV & games",
  food: "Food",
};

const q = (category: Category, text: string, choices: Question["choices"], answer: Question["answer"]): Question => ({ category, text, choices, answer });

export const QUESTIONS: Question[] = [
  // General knowledge
  q("general", "How many continents are there?", ["5", "6", "7", "8"], 2),
  q("general", "What is the largest ocean on Earth?", ["Atlantic", "Indian", "Arctic", "Pacific"], 3),
  q("general", "How many days are in a leap year?", ["364", "365", "366", "367"], 2),
  q("general", "What is the capital of Japan?", ["Kyoto", "Osaka", "Tokyo", "Sapporo"], 2),
  q("general", "How many sides does a hexagon have?", ["5", "6", "7", "8"], 1),
  q("general", "What is the capital of Australia?", ["Sydney", "Melbourne", "Canberra", "Perth"], 2),
  q("general", "How many players does a football (soccer) team have on the field?", ["9", "10", "11", "12"], 2),
  q("general", "In which country are the pyramids of Giza?", ["Mexico", "Egypt", "Peru", "Greece"], 1),
  q("general", "What is the capital of Vietnam?", ["Ho Chi Minh City", "Da Nang", "Hanoi", "Hue"], 2),
  q("general", "What is the highest mountain above sea level?", ["K2", "Kangchenjunga", "Mount Everest", "Lhotse"], 2),
  q("general", "How many hours are in a week?", ["148", "168", "172", "186"], 1),
  q("general", "What colour do you get by mixing blue and yellow?", ["Green", "Purple", "Orange", "Brown"], 0),
  q("general", "Which language has the most native speakers?", ["English", "Spanish", "Hindi", "Mandarin Chinese"], 3),
  q("general", "Ha Long Bay is in which country?", ["Thailand", "Vietnam", "Philippines", "Indonesia"], 1),
  q("general", "What is the currency of Japan?", ["Won", "Yuan", "Yen", "Baht"], 2),
  q("general", "How many minutes are in a day?", ["1,240", "1,440", "1,640", "2,400"], 1),
  // Science & nature
  q("science", "Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], 1),
  q("science", "What is the largest mammal?", ["African elephant", "Blue whale", "Giraffe", "Hippo"], 1),
  q("science", "Which gas do plants take in from the air?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], 2),
  q("science", "At sea level, water boils at…", ["90 °C", "100 °C", "110 °C", "120 °C"], 1),
  q("science", "Which planet is closest to the Sun?", ["Venus", "Earth", "Mercury", "Mars"], 2),
  q("science", "How many bones does an adult human have?", ["186", "206", "226", "256"], 1),
  q("science", "What is the chemical symbol for gold?", ["Go", "Gd", "Au", "Ag"], 2),
  q("science", "What keeps us on the ground?", ["Magnetism", "Friction", "Gravity", "Electricity"], 2),
  q("science", "How many legs does a spider have?", ["6", "8", "10", "12"], 1),
  q("science", "Which planet has the most famous rings?", ["Mars", "Saturn", "Neptune", "Venus"], 1),
  q("science", "Sunlight takes about how long to reach Earth?", ["8 seconds", "8 minutes", "8 hours", "8 days"], 1),
  q("science", "What is the hardest natural material?", ["Gold", "Iron", "Diamond", "Quartz"], 2),
  q("science", "Water freezes at…", ["0 °F", "32 °F", "100 °F", "212 °F"], 1),
  q("science", "What is H₂O?", ["Salt", "Water", "Hydrogen peroxide", "Oxygen"], 1),
  q("science", "Where in a plant does most photosynthesis happen?", ["Roots", "Leaves", "Flowers", "Seeds"], 1),
  // Music
  q("music", "How many keys does a standard piano have?", ["76", "88", "92", "100"], 1),
  q("music", "Which of these is a percussion instrument?", ["Flute", "Drum", "Trumpet", "Violin"], 1),
  q("music", "How many lines does a music staff have?", ["4", "5", "6", "7"], 1),
  q("music", "Do, Re, Mi, Fa, Sol, La, Ti: how many notes before Do comes again?", ["5", "6", "7", "8"], 2),
  q("music", "Which band sang “Hey Jude”?", ["The Rolling Stones", "The Beatles", "Queen", "ABBA"], 1),
  q("music", "Which group released “Dynamite” in 2020?", ["BLACKPINK", "BTS", "EXO", "TWICE"], 1),
  q("music", "Freddie Mercury was the singer of which band?", ["Queen", "Oasis", "Coldplay", "U2"], 0),
  q("music", "In music, what does “tempo” describe?", ["Loudness", "Speed", "Pitch", "Key"], 1),
  q("music", "How many strings does a standard guitar have?", ["4", "5", "6", "7"], 2),
  q("music", "Which of these is a woodwind instrument?", ["Trombone", "Clarinet", "Cello", "Harp"], 1),
  // Movies, TV & games
  q("screen", "In “Frozen”, what is the snowman called?", ["Olaf", "Sven", "Kristoff", "Hans"], 0),
  q("screen", "Which company makes the PlayStation?", ["Nintendo", "Microsoft", "Sony", "Sega"], 2),
  q("screen", "Who is Mario's brother?", ["Wario", "Luigi", "Toad", "Yoshi"], 1),
  q("screen", "Which game has creepers, blocks and diamonds?", ["Fortnite", "Minecraft", "Roblox", "Tetris"], 1),
  q("screen", "In “Harry Potter”, what is the school called?", ["Durmstrang", "Hogwarts", "Beauxbatons", "Ilvermorny"], 1),
  q("screen", "Which studio made “Spirited Away”?", ["Pixar", "Studio Ghibli", "DreamWorks", "Toei"], 1),
  q("screen", "In “The Lion King”, who is Simba's father?", ["Scar", "Mufasa", "Rafiki", "Timon"], 1),
  q("screen", "Pikachu is which type of Pokémon?", ["Fire", "Water", "Electric", "Grass"], 2),
  q("screen", "How many Infinity Stones are there in the Marvel films?", ["4", "5", "6", "7"], 2),
  q("screen", "In chess, which piece moves in an L shape?", ["Bishop", "Rook", "Knight", "Queen"], 2),
  q("screen", "How many squares are on a chessboard?", ["32", "49", "64", "81"], 2),
  q("screen", "In Tetris, how many squares make up each piece?", ["3", "4", "5", "6"], 1),
  // Food
  q("food", "Phở comes from which country?", ["Thailand", "China", "Vietnam", "Korea"], 2),
  q("food", "Sushi comes from which country?", ["China", "Japan", "Korea", "Vietnam"], 1),
  q("food", "Which fruit is called the “king of fruits” in Southeast Asia?", ["Mango", "Durian", "Jackfruit", "Rambutan"], 1),
  q("food", "What is the main ingredient of guacamole?", ["Tomato", "Avocado", "Pea", "Lime"], 1),
  q("food", "Bánh mì is a kind of…", ["Soup", "Sandwich", "Noodle dish", "Dessert"], 1),
  q("food", "Which nut is marzipan made from?", ["Peanut", "Cashew", "Almond", "Walnut"], 2),
  q("food", "Kimchi is a famous dish from…", ["Japan", "Korea", "China", "Thailand"], 1),
  q("food", "What makes chilli peppers hot?", ["Caffeine", "Capsaicin", "Citric acid", "Menthol"], 1),
  q("food", "Which country is famous for pizza Margherita?", ["Spain", "France", "Italy", "Greece"], 2),
];

// A random set: no repeats, mixed or from one category
export function pickQuestions(count: number, category: Category | "mixed" = "mixed", random = Math.random): Question[] {
  const pool = QUESTIONS.filter((x) => category === "mixed" || x.category === category);
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(count, a.length));
}
