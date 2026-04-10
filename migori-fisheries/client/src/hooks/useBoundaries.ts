import { useQuery } from "@tanstack/react-query";

type BoundaryCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

const fallbackCounty: BoundaryCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Migori County" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [33.8, -1.8],
            [34.9, -1.8],
            [34.9, -0.3],
            [33.8, -0.3],
            [33.8, -1.8]
          ]
        ]
      }
    }
  ]
};

const fallbackSubCounties: BoundaryCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Nyatike" },
      geometry: {
        type: "Polygon",
        coordinates: [[[33.82, -1.79], [34.15, -1.79], [34.15, -1.2], [33.82, -1.2], [33.82, -1.79]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Suna East" },
      geometry: {
        type: "Polygon",
        coordinates: [[[34.15, -1.2], [34.48, -1.2], [34.48, -0.85], [34.15, -0.85], [34.15, -1.2]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Suna West" },
      geometry: {
        type: "Polygon",
        coordinates: [[[33.95, -1.2], [34.15, -1.2], [34.15, -0.85], [33.95, -0.85], [33.95, -1.2]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Uriri" },
      geometry: {
        type: "Polygon",
        coordinates: [[[34.15, -0.85], [34.45, -0.85], [34.45, -0.55], [34.15, -0.55], [34.15, -0.85]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Kuria East" },
      geometry: {
        type: "Polygon",
        coordinates: [[[34.45, -1.2], [34.85, -1.2], [34.85, -0.75], [34.45, -0.75], [34.45, -1.2]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Kuria West" },
      geometry: {
        type: "Polygon",
        coordinates: [[[34.45, -0.75], [34.85, -0.75], [34.85, -0.35], [34.45, -0.35], [34.45, -0.75]]]
      }
    }
  ]
};

const fallbackWards: BoundaryCollection = {
  type: "FeatureCollection",
  features: fallbackSubCounties.features.map((feature, index) => ({
    ...feature,
    properties: {
      ...feature.properties,
      ward_name: `${String(feature.properties.name)} Ward ${index + 1}`,
      sub_county: feature.properties.name
    }
  }))
};

const resolveBoundaryBaseUrl = (): string | null => {
  const fromEnv = import.meta.env.VITE_BOUNDARIES_BASE_URL;
  if (fromEnv) return fromEnv;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/boundaries`;
  }

  return null;
};

const fetchGeoJson = async (path: string, fallback: BoundaryCollection): Promise<BoundaryCollection> => {
  const baseUrl = resolveBoundaryBaseUrl();

  if (!baseUrl) {
    return fallback;
  }

  try {
    const response = await fetch(`${baseUrl}/${path}`);
    if (!response.ok) {
      return fallback;
    }

    const data = (await response.json()) as BoundaryCollection;
    if (!data.features?.length) {
      return fallback;
    }

    return data;
  } catch {
    return fallback;
  }
};

export const useBoundaries = () => {
  const countyQuery = useQuery({
    queryKey: ["boundaries", "county"],
    queryFn: () => fetchGeoJson("migori_county.geojson", fallbackCounty),
    staleTime: Number.POSITIVE_INFINITY
  });

  const subCountyQuery = useQuery({
    queryKey: ["boundaries", "subcounties"],
    queryFn: () => fetchGeoJson("migori_subcounties.geojson", fallbackSubCounties),
    staleTime: Number.POSITIVE_INFINITY
  });

  const wardsQuery = useQuery({
    queryKey: ["boundaries", "wards"],
    queryFn: () => fetchGeoJson("migori_wards.geojson", fallbackWards),
    staleTime: Number.POSITIVE_INFINITY
  });

  return {
    county: countyQuery.data ?? fallbackCounty,
    subCounties: subCountyQuery.data ?? fallbackSubCounties,
    wards: wardsQuery.data ?? fallbackWards,
    isLoading: countyQuery.isLoading || subCountyQuery.isLoading || wardsQuery.isLoading
  };
};
