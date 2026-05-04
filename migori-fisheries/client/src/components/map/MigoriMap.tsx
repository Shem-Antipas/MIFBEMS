import { useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import html2canvas from "html2canvas";
import type { Role } from "@/types";
import { useBoundaries } from "@/hooks/useBoundaries";
import MapLegend from "@/components/map/MapLegend";
import SubCountyLayer, { type MapMetric } from "@/components/map/SubCountyLayer";
import WardLayer from "@/components/map/WardLayer";
import { MIGORI_SUBCOUNTIES } from "@/lib/locationData";
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

const metricUnits: Record<MapMetric, string> = {
  farmers: "farmers",
  production: "kg",
  licenses: "licenses"
};

const formatMapNumber = (value: number, maximumFractionDigits = 0): string =>
  value.toLocaleString(undefined, { maximumFractionDigits });

const fishIcon = L.divIcon({
  className: "custom-fish-icon",
  html: '<div style="display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:#0f766e;color:white;font-size:11px;font-weight:700">F</div>',
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
  const [hoveredSubCounty, setHoveredSubCounty] = useState<string | null>(null);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);

  const { county, subCounties, wards, isLoading } = useBoundaries();

  const mapMetrics = useMemo(
    () => ({
      farmers: farmersBySubCounty,
      production: productionBySubCounty,
      licenses: licensesBySubCounty
    }),
    [farmersBySubCounty, licensesBySubCounty, productionBySubCounty]
  );

  const ranges = useMemo(() => {
    const values = Object.values(mapMetrics[metric]);
    const maxValue = values.length ? Math.max(...values) : 0;

    return [
      "0",
      Math.ceil(maxValue * 0.25).toString(),
      Math.ceil(maxValue * 0.5).toString(),
      Math.ceil(maxValue).toString()
    ];
  }, [mapMetrics, metric]);

  const distributionRows = useMemo(() => {
    const totals = {
      farmers: Object.values(farmersBySubCounty).reduce((total, value) => total + value, 0),
      production: Object.values(productionBySubCounty).reduce((total, value) => total + value, 0),
      licenses: Object.values(licensesBySubCounty).reduce((total, value) => total + value, 0)
    };

    return MIGORI_SUBCOUNTIES.map((subCounty) => {
      const value = mapMetrics[metric][subCounty] ?? 0;
      const farmers = farmersBySubCounty[subCounty] ?? 0;
      const licenses = licensesBySubCounty[subCounty] ?? 0;
      const share = totals[metric] > 0 ? (value / totals[metric]) * 100 : 0;

      return {
        subCounty,
        value,
        valueLabel: `${formatMapNumber(value)} ${metricUnits[metric]}`,
        share,
        coverage: farmers > 0 ? Math.min((licenses / farmers) * 100, 100) : 0
      };
    });
  }, [farmersBySubCounty, licensesBySubCounty, mapMetrics, metric, productionBySubCounty]);

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

      <div ref={mapWrapRef} className="relative h-[320px] overflow-hidden rounded-xl border sm:h-[430px]">
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
            <WardLayer
              data={wards}
              selectedSubCounty={selectedSubCounty}
              onBack={() => {
                setHoveredSubCounty(null);
                setSelectedSubCounty(null);
              }}
            />
          ) : (
            <SubCountyLayer
              data={subCounties}
              metric={metric}
              metrics={mapMetrics}
              officerSubCounty={role === "FISHERIES_OFFICER" ? userSubCounty : null}
              onSubCountyHover={setHoveredSubCounty}
              onSubCountyClick={(subCounty) => {
                setHoveredSubCounty(null);
                setSelectedSubCounty(subCounty);
              }}
            />
          )}
        </MapContainer>

        {role !== "FARMER" ? (
          <MapLegend title={metricLabels[metric]} stops={metricStops[metric]} ranges={ranges} />
        ) : null}

        {role !== "FARMER" && !selectedSubCounty ? (
          <div className="absolute bottom-3 right-3 z-[500] w-[min(20rem,calc(100%-1.5rem))] rounded-lg border bg-card/95 p-3 text-xs shadow sm:bottom-4 sm:right-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">All Sub-Counties</p>
                <p className="mt-1 text-muted-foreground">{metricLabels[metric]} distribution</p>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
                {hoveredSubCounty ?? "County"}
              </span>
            </div>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {distributionRows.map((row) => (
                <div
                  key={row.subCounty}
                  className={`rounded-md p-1.5 ${hoveredSubCounty === row.subCounty ? "bg-primary/10" : ""}`}
                >
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-foreground">{row.subCounty}</span>
                    <span className="text-muted-foreground">{row.valueLabel}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(Math.max(row.share, row.share > 0 ? 4 : 0), 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{formatMapNumber(row.share, 1)}% share</span>
                    <span>{formatMapNumber(row.coverage, 1)}% licensing</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MigoriMap;
