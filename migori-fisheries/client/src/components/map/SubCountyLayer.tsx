import { GeoJSON } from "react-leaflet";
import type { Layer } from "leaflet";

export type MapMetric = "farmers" | "production" | "licenses";

type BoundaryCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

interface SubCountyLayerProps {
  data: BoundaryCollection;
  metric: MapMetric;
  metrics: {
    farmers: Record<string, number>;
    production: Record<string, number>;
    licenses: Record<string, number>;
  };
  officerSubCounty?: string | null;
  onSubCountyClick: (subCounty: string) => void;
}

const palettes: Record<MapMetric, string[]> = {
  farmers: ["#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#065f46"],
  production: ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1e3a8a"],
  licenses: ["#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#92400e"]
};

const getFeatureName = (feature: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>): string => {
  const props = feature.properties;
  const candidates = [
    props?.name,
    props?.NAME,
    props?.name_en,
    props?.sub_county,
    props?.COUNTY,
    props?.ADM2_EN,
    props?.ADM3_EN
  ];

  return String(candidates.find((item) => typeof item === "string") ?? "Unknown");
};

const quantizeColor = (value: number, max: number, metric: MapMetric): string => {
  if (value <= 0 || max <= 0) return "#f3f4f6";
  const palette = palettes[metric];
  const index = Math.min(palette.length - 1, Math.floor((value / max) * palette.length));
  return palette[index];
};

const SubCountyLayer = ({ data, metric, metrics, officerSubCounty, onSubCountyClick }: SubCountyLayerProps) => {
  const values = Object.values(metrics[metric]);
  const maxValue = values.length ? Math.max(...values) : 0;

  return (
    <GeoJSON
      data={data}
      style={(feature) => {
        if (!feature) {
          return { color: "#94a3b8", weight: 1, fillOpacity: 0.35, fillColor: "#f3f4f6" };
        }

        const name = getFeatureName(feature);
        const value = metrics[metric][name] ?? 0;

        return {
          color: officerSubCounty && name === officerSubCounty ? "#0f766e" : "#64748b",
          weight: officerSubCounty && name === officerSubCounty ? 3 : 1,
          fillColor: quantizeColor(value, maxValue, metric),
          fillOpacity: officerSubCounty && name !== officerSubCounty ? 0.3 : 0.75
        };
      }}
      onEachFeature={(feature, layer: Layer) => {
        const name = getFeatureName(feature);
        const farmersValue = metrics.farmers[name] ?? 0;
        const productionValue = metrics.production[name] ?? 0;
        const licensesValue = metrics.licenses[name] ?? 0;

        layer.bindTooltip(
          `<strong>${name}</strong><br/>Farmers: ${farmersValue}<br/>Production: ${productionValue} kg<br/>Licenses: ${licensesValue}`,
          { sticky: true }
        );

        layer.on({
          click: () => onSubCountyClick(name)
        });
      }}
    />
  );
};

export default SubCountyLayer;
