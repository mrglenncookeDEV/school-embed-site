export const HOUSE_DEFINITIONS = [
  { id: "earth", name: "Earth", color: "#16a34a", numericId: 1 },
  { id: "water", name: "Water", color: "#2563eb", numericId: 2 },
  { id: "fire", name: "Fire", color: "#f97316", numericId: 3 },
  { id: "wind", name: "Wind", color: "#facc15", numericId: 4 },
  { id: "spirit", name: "Spirit", color: "#a855f7", numericId: 5 },
];

const HOUSE_KEY_LOOKUP = HOUSE_DEFINITIONS.reduce((acc, house) => {
  acc[house.id] = house.id;
  if (house.numericId !== undefined && house.numericId !== null) {
    acc[house.numericId] = house.id;
    acc[String(house.numericId)] = house.id;
  }
  return acc;
}, {});

export function resolveHouseKey(value) {
  if (value == null) {
    return null;
  }
  const key = HOUSE_KEY_LOOKUP[value] ?? HOUSE_KEY_LOOKUP[String(value)];
  return key ?? null;
}
