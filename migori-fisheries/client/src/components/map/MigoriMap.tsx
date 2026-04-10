import { useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import html2canvas from "html2canvas";
import type { Role } from "@/types";
import { useBoundaries } from "@/hooks/useBoundaries";
import MapLegend from "@/components/map/MapLegend";
import SubCountyLayer, { type MapMetric } from "@/components/map/SubCountyLayer";
import WardLayer from "@/components/map/WardLayer";
import "leaflet/dist/leaflet.css";

interface MigoriMapProps {
  role: Role;
  userSubCounty?: string | null;
  farmersBySubCounty: Record<string, number>;
  productionBySubCounty: Record<string, number>;
  licensesBySubCounty: Record<string, number>;
  farmerLocation?: { lat: number; lng: number } | null;
}

const metricLabels: Record<MapMetric, string> = {
  farmers: "Farmer Density",
  production: "Fish Production",
  licenses: "License Compliance"
};

const metricStops: Record<MapMetric, string[]> = {
  farmers: ["#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#065f46"],
  production: ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1e3a8a"],
  licenses: ["#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#92400e"]
};

const fishIcon = L.divIcon({
  className: "custom-fish-icon",
  html: '<div style="font-size:20px;line-height:1">🐟</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const MigoriMap = ({
  role,
  userSubCounty,
  farmersBySubCounty,
  productionBySubCounty,
  licensesBySubCounty,
  farmerLocation
}: MigoriMapProps) => {
  const [metric, setMetric] = useState<MapMetric>("farmers");
  const [selectedSubCounty, setSelectedSubCounty] = useState<string | null>(null);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);

  const { county, subCounties, wards, isLoading } = useBoundaries();

  const ranges = useMemo(() => {
    const values = Object.values(
      metric === "farmers" ? farmersBySubCounty : metric === "production" ? productionBySubCounty : licensesBySubCounty
    );

    const maxValue = values.length ? Math.max(...values) : 0;
    return ["0", Math.ceil(maxValue * 0.25).toString(), Math.ceil(maxValue * 0.5).toString(), Math.ceil(maxValue).toString()];
  }, [farmersBySubCounty, licensesBySubCounty, metric, productionBySubCounty]);

  const exportMap = async () => {
    if (!mapWrapRef.current) return;

    const canvas = await html2canvas(mapWrapRef.current);
    const link = document.createElement("a");
    link.download = `migori-map-${metric}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="space-y-3">
      {role !== "FARMER" ? (
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(metricLabels) as MapMetric[]).map((item) => (
            <button
              key={item}
              onClick={() => setMetric(item)}
              className={`rounded-lg px-3 py-1.5 text-sm ${metric === item ? "bg-primary text-white" : "bg-secondary text-foreground"}`}
            >
              {metricLabels[item]}
            </button>
          ))}
          {role === "DATA_ANALYST" ? (
            <button onClick={() => void exportMap()} className="rounded-lg border px-3 py-1.5 text-sm">
              Export as PNG
            </button>
          ) : null}
        </div>
      ) : null}

      <div ref={mapWrapRef} className="relative h-[430px] overflow-hidden rounded-xl border">
        {isLoading ? <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map...</div> : null}

        <MapContainer center={[-1.0634, 34.4199]} zoom={9} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.45}
            attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          />

          <GeoJSON
            data={county}
            style={() => ({ color: "#0f172a", weight: 3, fillOpacity: 0, opacity: 0.9 })}
          />

          {role === "FARMER" ? (
            farmerLocation ? (
              <Marker position={[farmerLocation.lat, farmerLocation.lng]} icon={fishIcon}>
                <Popup>Your farm location</Popup>
              </Marker>
            ) : null
          ) : selectedSubCounty ? (
            <WardLayer data={wards} selectedSubCounty={selectedSubCounty} onBack={() => setSelectedSubCounty(null)} />
          ) : (
            <SubCountyLayer
              data={subCounties}
              metric={metric}
              metrics={{
                farmers: farmersBySubCounty,
                production: productionBySubCounty,
                licenses: licensesBySubCounty
              }}
              officerSubCounty={role === "FISHERIES_OFFICER" ? userSubCounty : null}
              onSubCountyClick={(subCounty) => setSelectedSubCounty(subCounty)}
            />
          )}
        </MapContainer>

        {role !== "FARMER" ? (
          <MapLegend title={metricLabels[metric]} stops={metricStops[metric]} ranges={ranges} />
        ) : null}
      </div>
    </div>
  );
};

export default MigoriMap;
