import { HOUSE_DEFINITIONS } from "../../shared/house-definitions.js";

export const CANONICAL_HOUSES = HOUSE_DEFINITIONS.map((house) => ({
  id: house.numericId,
  houseId: house.numericId,
  name: house.name,
  color: house.color,
}));

export function getCanonicalHouses() {
  return CANONICAL_HOUSES;
}
