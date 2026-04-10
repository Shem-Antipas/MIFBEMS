import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CreateFarmerPayload } from "@/api/farmers";

const farmerSchema = z.object({
  name: z.string().min(2),
  subCounty: z.string().min(2),
  farmType: z.enum(["POND", "CAGE", "TANK", "DAM"]),
  species: z.string().min(2),
  productionKg: z.number().min(0),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

type FarmerFormValues = z.infer<typeof farmerSchema>;

interface FarmerModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateFarmerPayload) => Promise<void>;
  isSubmitting: boolean;
}

const MapPicker = ({ onPick }: { onPick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    }
  });

  return null;
};

const FarmerModal = ({ open, onClose, onSubmit, isSubmitting }: FarmerModalProps) => {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<FarmerFormValues>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: "",
      subCounty: "",
      farmType: "POND",
      species: "Tilapia",
      productionKg: 0
    }
  });

  if (!open) {
    return null;
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    setGeoLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = (await response.json()) as {
        address?: { county?: string; state_district?: string; municipality?: string };
      };

      const countyGuess = data.address?.state_district ?? data.address?.county ?? data.address?.municipality;
      if (countyGuess) {
        setValue("subCounty", countyGuess.replace("Sub-County", "").trim());
      }
    } catch (_error) {
      // Best-effort geocoding
    } finally {
      setGeoLoading(false);
    }
  };

  const submitForm = async (values: FarmerFormValues) => {
    await onSubmit({
      name: values.name,
      subCounty: values.subCounty,
      farmType: values.farmType,
      species: values.species.split(",").map((item) => item.trim()).filter(Boolean),
      productionKg: values.productionKg,
      status: "ACTIVE",
      latitude: location?.lat,
      longitude: location?.lng
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Register Farmer</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit(submitForm)}>
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input {...register("name")} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sub-County</label>
            <Input {...register("subCounty")} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Farm Type</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" {...register("farmType")}>
              <option value="POND">Pond</option>
              <option value="CAGE">Cage</option>
              <option value="TANK">Tank</option>
              <option value="DAM">Dam</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Species (comma separated)</label>
            <Input {...register("species")} placeholder="Tilapia, Catfish" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Production (Kg)</label>
            <Input type="number" step="0.1" {...register("productionKg", { valueAsNumber: true })} />
          </div>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium">Farm Geolocation (click map to drop pin)</p>
            <div className="h-48 overflow-hidden rounded-lg border">
              <MapContainer center={[-1.0634, 34.4199]} zoom={9} className="h-full w-full">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                />
                <MapPicker
                  onPick={(lat, lng) => {
                    setLocation({ lat, lng });
                    setValue("latitude", lat);
                    setValue("longitude", lng);
                    void reverseGeocode(lat, lng);
                  }}
                />
              </MapContainer>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {location ? `Selected: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "No point selected."}
              {geoLoading ? " Resolving location..." : ""}
            </p>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Farmer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FarmerModal;
