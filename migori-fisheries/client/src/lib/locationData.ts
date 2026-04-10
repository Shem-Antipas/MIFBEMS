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
