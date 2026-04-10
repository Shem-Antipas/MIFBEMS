import { GeoJSON } from "react-leaflet";

type BoundaryCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

interface WardLayerProps {
  data: BoundaryCollection;
  selectedSubCounty: string;
  onBack: () => void;
}

const getSubCounty = (props: Record<string, unknown> | null): string => {
  const candidates = [props?.sub_county, props?.SUBCOUNTY, props?.ADM2_EN, props?.name];
  return String(candidates.find((item) => typeof item === "string") ?? "");
};

const getWardName = (props: Record<string, unknown> | null): string => {
  const candidates = [props?.ward_name, props?.WARD, props?.ADM3_EN, props?.name];
  return String(candidates.find((item) => typeof item === "string") ?? "Ward");
};

const WardLayer = ({ data, selectedSubCounty, onBack }: WardLayerProps) => {
  const filteredFeatures = data.features.filter((feature) => getSubCounty(feature.properties) === selectedSubCounty);
  const filteredData = {
    type: "FeatureCollection",
    features: filteredFeatures
  } as GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

  return (
    <>
      <button
        onClick={onBack}
        className="absolute right-4 top-4 z-[500] rounded-lg border bg-white px-3 py-1.5 text-xs font-medium shadow"
      >
        Back to Sub-Counties
      </button>
      <GeoJSON
        data={filteredData}
        style={() => ({
          color: "#334155",
          weight: 1,
          fillColor: "#e2e8f0",
          fillOpacity: 0.35,
          dashArray: "3 3"
        })}
        onEachFeature={(feature, layer) => {
          layer.bindTooltip(getWardName(feature.properties), { sticky: true });
        }}
      />
    </>
  );
};

export default WardLayer;
