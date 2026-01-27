import { Droplets, Earth, Flame, Sparkles, Wind } from "lucide-react";
import { HOUSE_DEFINITIONS, resolveHouseKey as resolveCanonicalHouseKey } from "@shared/house-definitions";

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
  return resolveCanonicalHouseKey(value);
}

export function getHouseById(id) {
  const canonicalId = resolveHouseKey(id);
  if (!canonicalId) {
    return null;
  }
  return HOUSES[canonicalId] ?? null;
}
