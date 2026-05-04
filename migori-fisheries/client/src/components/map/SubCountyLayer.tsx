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
  onSubCountyHover?: (subCounty: string | null) => void;
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

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const getShare = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0);

const formatNumber = (value: number, maximumFractionDigits = 0): string =>
  value.toLocaleString(undefined, { maximumFractionDigits });

const SubCountyLayer = ({
  data,
  metric,
  metrics,
  officerSubCounty,
  onSubCountyClick,
  onSubCountyHover
}: SubCountyLayerProps) => {
  const values = Object.values(metrics[metric]);
  const maxValue = values.length ? Math.max(...values) : 0;
  const totals = {
    farmers: Object.values(metrics.farmers).reduce((total, value) => total + value, 0),
    production: Object.values(metrics.production).reduce((total, value) => total + value, 0),
    licenses: Object.values(metrics.licenses).reduce((total, value) => total + value, 0)
  };

  return (
    <GeoJSON
      key={metric}
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
        const activeValue = metrics[metric][name] ?? 0;
        const activeShare = getShare(activeValue, totals[metric]);
        const complianceRate = farmersValue > 0 ? Math.min((licensesValue / farmersValue) * 100, 100) : 0;

        layer.bindTooltip(
          `<strong>${escapeHtml(name)}</strong><br/>Selected share: ${formatNumber(activeShare, 1)}%<br/>Farmers: ${formatNumber(farmersValue)}<br/>Production: ${formatNumber(productionValue)} kg<br/>Licenses: ${formatNumber(licensesValue)}<br/>Licensing coverage: ${formatNumber(complianceRate, 1)}%`,
          { sticky: true }
        );

        layer.on({
          mouseover: () => onSubCountyHover?.(name),
          mouseout: () => onSubCountyHover?.(null),
          click: () => onSubCountyClick(name)
        });
      }}
    />
  );
};

export default SubCountyLayer;
