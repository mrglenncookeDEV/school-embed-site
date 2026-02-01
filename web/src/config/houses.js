import { Droplets, Earth, Flame, Sparkles, Wind } from "lucide-react";

// HARDCODED COPY FROM SHARED TO DEBUG IMPORT ISSUE
const HOUSE_DEFINITIONS = [
  { id: "earth", name: "Earth", color: "#16a34a", numericId: 1 },
  { id: "water", name: "Water", color: "#2563eb", numericId: 2 },
  { id: "fire", name: "Fire", color: "#f97316", numericId: 3 },
  { id: "wind", name: "Wind", color: "#facc15", numericId: 4 },
  { id: "spirit", name: "Spirit", color: "#a855f7", numericId: 5 },
];

const ICON_MAP = {
  earth: Earth,
  water: Droplets,
  fire: Flame,
  wind: Wind,
  spirit: Sparkles,
};

export const HOUSES = HOUSE_DEFINITIONS.reduce((acc, house) => {
  acc[house.id] = {
    ...house,
    icon: ICON_MAP[house.id],
  };
  return acc;
}, {});

export const HOUSE_ORDER = HOUSE_DEFINITIONS.map((house) => house.id);

export function resolveHouseKey(value) {
  if (value == null) return null;
  const str = String(value).toLowerCase();
  // Simple lookup simulation
  const found = HOUSE_DEFINITIONS.find(h => h.id === str || String(h.numericId) === str);
  return found ? found.id : null;
}

export function getHouseById(id) {
  const canonicalId = resolveHouseKey(id);
  if (!canonicalId) {
    return null;
  }
  return HOUSES[canonicalId] ?? null;
}
