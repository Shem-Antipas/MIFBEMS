#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "client/src/data/boundaries");

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const queries = {
  county: `[out:json][timeout:30];\nrelation["name"="Migori County"]["admin_level"="4"]["boundary"="administrative"];\nout geom;`,
  subcounties: `[out:json][timeout:30];\narea["name"="Migori County"]["admin_level"="4"]->.migori;\nrelation["admin_level"="6"]["boundary"="administrative"](area.migori);\nout geom;`,
  wards: `[out:json][timeout:30];\narea["name"="Migori County"]["admin_level"="4"]->.migori;\nrelation["admin_level"="8"]["boundary"="administrative"](area.migori);\nout geom;`
};

const outputFiles = {
  county: "migori_county.geojson",
  subcounties: "migori_subcounties.geojson",
  wards: "migori_wards.geojson"
};

const resolveOsmToGeoJson = async () => {
  const localModulePath = path.join(rootDir, "client/node_modules/osmtogeojson/index.js");
  const moduleUrl = pathToFileURL(localModulePath).href;
  const imported = await import(moduleUrl);
  return imported.default;
};

const postOverpass = async (query) => {
  const response = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

const writeGeoJson = async (filename, geojson) => {
  await fs.mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, filename);
  await fs.writeFile(filePath, JSON.stringify(geojson, null, 2), "utf-8");
  console.log(`Saved ${filePath}`);
};

const run = async () => {
  try {
    const osmtogeojson = await resolveOsmToGeoJson();

    const countyJson = await postOverpass(queries.county);
    const subCountiesJson = await postOverpass(queries.subcounties);
    const wardsJson = await postOverpass(queries.wards);

    await writeGeoJson(outputFiles.county, osmtogeojson(countyJson));
    await writeGeoJson(outputFiles.subcounties, osmtogeojson(subCountiesJson));
    await writeGeoJson(outputFiles.wards, osmtogeojson(wardsJson));

    console.log("Boundary fetch complete.");
  } catch (error) {
    console.error("Boundary fetch failed.", error);
    console.error("Fallback strategy:");
    console.error("1. Download Kenya admin boundaries from https://data.humdata.org/dataset/cod-ab-ken");
    console.error("2. Extract ADM2 and ADM3 files.");
    console.error("3. Filter where COUNTY_NAM == 'MIGORI' using mapshaper.");
    console.error("4. Save outputs as:");
    console.error(`   - ${path.join(outputDir, outputFiles.county)}`);
    console.error(`   - ${path.join(outputDir, outputFiles.subcounties)}`);
    console.error(`   - ${path.join(outputDir, outputFiles.wards)}`);
    process.exit(1);
  }
};

void run();
