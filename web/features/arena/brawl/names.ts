// Stage 25 · Chợ Đêm Brawl: names and short descriptions shown in the menus (translated with t()).
import { tx } from "@/lib/i18n/core";
import type { Buff, EnemyKind, HeroKind } from "./brawl";

export const HERO_INFO: Record<HeroKind, { name: string; role: string; attack: string; special: string; emoji: string; color: string }> = {
  chef: { name: tx("The Chef"), role: tx("Tough, hits everyone in front"), attack: tx("Ladle swing"), special: tx("Boiling Pot: a big splash that stuns"), emoji: "🍜", color: "from-amber-400 to-orange-600" },
  shipper: { name: tx("The Shipper"), role: tx("Fast, quick hits"), attack: tx("Quick jabs"), special: tx("Scooter Dash: zoom through the crowd"), emoji: "🛵", color: "from-emerald-400 to-teal-600" },
  grandma: { name: tx("Grandma"), role: tx("Helper: heals and revives"), attack: tx("Flying slipper (comes back)"), special: tx("Tea Time: heals and helps everyone up"), emoji: "🍵", color: "from-violet-400 to-purple-700" },
  student: { name: tx("The Student"), role: tx("Hits hard from far away"), attack: tx("Slingshot"), special: tx("Homework Storm: paper planes everywhere"), emoji: "🎒", color: "from-sky-400 to-blue-700" },
};

export const ENEMY_NAMES: Record<EnemyKind, string> = {
  rat: tx("Pickpocket Rat"),
  ninja: tx("Umbrella Ninja"),
  balloon: tx("Balloon Seller"),
  umbrellaBoss: tx("The Umbrella Master"),
  karaokeKing: tx("The Karaoke King"),
};

export const AREA_NAMES = [tx("Noodle Lane"), tx("Fruit Corner"), tx("Lantern Square"), tx("Toy Street"), tx("Karaoke Stage")];

export const BUFF_INFO: Record<Buff, { name: string; what: string; emoji: string }> = {
  banhmi: { name: "Bánh mì", what: tx("+25 health and a full heal"), emoji: "🥖" },
  che: { name: "Chè", what: tx("Your special charges 40% faster"), emoji: "🍧" },
  caphe: { name: "Cà phê sữa đá", what: tx("12% faster feet"), emoji: "🧋" },
  banhxeo: { name: "Bánh xèo", what: tx("20% harder bonks"), emoji: "🥞" },
};
