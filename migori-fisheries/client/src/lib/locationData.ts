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

export interface LocationPoint {
  lat: number;
  lng: number;
}

export const SUBCOUNTY_COORDINATES: Record<MigoriSubCounty, LocationPoint> = {
  Awendo: { lat: -0.8908, lng: 34.5356 },
  "Kuria East": { lat: -1.1548, lng: 34.6483 },
  "Kuria West": { lat: -1.2445, lng: 34.4798 },
  Nyatike: { lat: -1.3106, lng: 34.2457 },
  Rongo: { lat: -0.7525, lng: 34.5981 },
  "Suna East": { lat: -1.0634, lng: 34.4742 },
  "Suna West": { lat: -1.0871, lng: 34.3859 },
  Uriri: { lat: -0.9252, lng: 34.4618 }
};

export const WARD_COORDINATES: Record<MigoriSubCounty, Record<string, LocationPoint>> = {
  Awendo: {
    "North Sakwa": { lat: -0.8468, lng: 34.5323 },
    "South Sakwa": { lat: -0.9339, lng: 34.5369 },
    "West Sakwa": { lat: -0.8974, lng: 34.4896 },
    "Central Sakwa": { lat: -0.8908, lng: 34.5356 }
  },
  "Kuria East": {
    "Gokeharaka/Getambwega": { lat: -1.0754, lng: 34.6768 },
    "Nyabasi East": { lat: -1.1834, lng: 34.7143 },
    "Nyabasi West": { lat: -1.1984, lng: 34.6132 },
    "Ntimaru East": { lat: -1.2475, lng: 34.6902 },
    "Ntimaru West": { lat: -1.2736, lng: 34.5968 }
  },
  "Kuria West": {
    "Bukira East": { lat: -1.127, lng: 34.515 },
    "Bukira Central/Ikerege": { lat: -1.1643, lng: 34.4991 },
    "Nyamosense/Getambwega": { lat: -1.1052, lng: 34.4378 },
    Isebania: { lat: -1.2398, lng: 34.4787 },
    Makerero: { lat: -1.3018, lng: 34.4642 },
    Masaba: { lat: -1.2018, lng: 34.4191 },
    Tagare: { lat: -1.2826, lng: 34.3836 }
  },
  Nyatike: {
    Kachieng: { lat: -1.5504, lng: 34.2167 },
    "Macalder/Kanyarwanda": { lat: -1.2676, lng: 34.2374 },
    Muhuru: { lat: -1.5764, lng: 34.0871 },
    Kanyasa: { lat: -1.4248, lng: 34.0943 },
    Kaler: { lat: -1.2507, lng: 34.1702 },
    "North Kadem": { lat: -1.1655, lng: 34.2896 },
    "Got Kachola": { lat: -1.3537, lng: 34.3231 }
  },
  Rongo: {
    "North Kamagambo": { lat: -0.7047, lng: 34.5903 },
    "East Kamagambo": { lat: -0.7607, lng: 34.6644 },
    "South Kamagambo": { lat: -0.8139, lng: 34.5941 },
    "Central Kamagambo": { lat: -0.7525, lng: 34.5981 }
  },
  "Suna East": {
    "God Jope": { lat: -1.0634, lng: 34.4742 },
    Kwa: { lat: -1.0205, lng: 34.4447 },
    "Suna Central": { lat: -1.0709, lng: 34.4393 },
    Kakrao: { lat: -1.1123, lng: 34.4995 }
  },
  "Suna West": {
    Wiga: { lat: -1.169, lng: 34.311 },
    Wasimbete: { lat: -1.1132, lng: 34.3577 },
    "Wasweta II": { lat: -1.0691, lng: 34.3926 },
    "Ragana-Oruba": { lat: -1.0383, lng: 34.3373 }
  },
  Uriri: {
    "West Kanyamkago": { lat: -0.784, lng: 34.482 },
    "South Kanyamkago": { lat: -0.9736, lng: 34.4868 },
    "East Kanyamkago": { lat: -0.9105, lng: 34.5374 },
    "North Kanyamkago": { lat: -0.8345, lng: 34.4537 },
    "Central Kanyamkago": { lat: -0.9087, lng: 34.4656 }
  }
};

export const getWardCoordinates = (subCounty: MigoriSubCounty, ward: string): LocationPoint =>
  WARD_COORDINATES[subCounty][ward] ?? SUBCOUNTY_COORDINATES[subCounty];
