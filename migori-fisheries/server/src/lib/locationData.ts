export const MIGORI_SUBCOUNTIES = [
  "Awendo",
  "Kuria East",
  "Kuria West",
  "Nyatike",
  "Rongo",
  "Suna East",
  "Suna West",
  "Uriri"
] as const;

export type MigoriSubCounty = (typeof MIGORI_SUBCOUNTIES)[number];

export const WARDS_BY_SUBCOUNTY: Record<MigoriSubCounty, readonly string[]> = {
  Awendo: ["North Sakwa", "South Sakwa", "West Sakwa", "Central Sakwa"],
  "Kuria East": ["Gokeharaka/Getambwega", "Nyabasi East", "Nyabasi West", "Ntimaru East", "Ntimaru West"],
  "Kuria West": ["Bukira East", "Bukira Central/Ikerege", "Nyamosense/Getambwega", "Isebania", "Makerero", "Masaba", "Tagare"],
  Nyatike: ["Kachieng", "Macalder/Kanyarwanda", "Muhuru", "Kanyasa", "Kaler", "North Kadem", "Got Kachola"],
  Rongo: ["North Kamagambo", "East Kamagambo", "South Kamagambo", "Central Kamagambo"],
  "Suna East": ["God Jope", "Kwa", "Suna Central", "Kakrao"],
  "Suna West": ["Wiga", "Wasimbete", "Wasweta II", "Ragana-Oruba"],
  Uriri: ["West Kanyamkago", "South Kanyamkago", "East Kanyamkago", "North Kanyamkago", "Central Kanyamkago"]
};

const normalizeLocationKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const WARD_ALIASES_BY_SUBCOUNTY: Partial<Record<MigoriSubCounty, Record<string, string>>> = {
  "Kuria West": {
    [normalizeLocationKey("Mabera")]: "Tagare",
    [normalizeLocationKey("Bukira Central")]: "Nyamosense/Getambwega",
    [normalizeLocationKey("Kehancha")]: "Bukira East"
  },
  "Kuria East": {
    [normalizeLocationKey("Gokeharaka")]: "Gokeharaka/Getambwega"
  },
  "Suna West": {
    [normalizeLocationKey("oruba-Ragana")]: "Ragana-Oruba",
    [normalizeLocationKey("Oruba Ragana")]: "Ragana-Oruba"
  }
};

export const toCanonicalWardForSubCounty = (subCounty: string, ward: string): string => {
  const wards = WARDS_BY_SUBCOUNTY[subCounty as MigoriSubCounty];
  if (!wards) return ward.trim();

  const normalizedWard = normalizeLocationKey(ward);
  const directMatch = wards.find((item) => normalizeLocationKey(item) === normalizedWard);
  if (directMatch) return directMatch;

  return WARD_ALIASES_BY_SUBCOUNTY[subCounty as MigoriSubCounty]?.[normalizedWard] ?? ward.trim();
};

export const isValidWardForSubCounty = (subCounty: string, ward: string): boolean => {
  const wards = WARDS_BY_SUBCOUNTY[subCounty as MigoriSubCounty];
  if (!wards) return false;

  const canonicalWard = toCanonicalWardForSubCounty(subCounty, ward);
  return wards.some((item) => normalizeLocationKey(item) === normalizeLocationKey(canonicalWard));
};
