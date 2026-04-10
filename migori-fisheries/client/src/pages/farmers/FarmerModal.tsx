import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CreateFarmerPayload } from "@/api/farmers";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY } from "@/lib/locationData";

const farmerSchema = z.object({
  name: z.string().min(2),
  subCounty: z.enum(MIGORI_SUBCOUNTIES),
  ward: z.string().min(2, "Ward is required"),
  farmType: z.enum(["POND", "CAGE", "TANK", "DAM"]),
  species: z.string().min(2),
  productionKg: z.number().min(0),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  issueLicense: z.boolean(),
  licenseNo: z.string().optional(),
  licenseType: z.enum(["AQUACULTURE", "COMMERCIAL_FISHING", "ARTISANAL_FISHING"]).optional(),
  licenseIssuedDate: z.string().optional(),
  licenseExpiryDate: z.string().optional()
}).superRefine((value, ctx) => {
  const wards = WARDS_BY_SUBCOUNTY[value.subCounty];
  if (!wards.includes(value.ward)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ward"],
      message: "Selected ward does not belong to the selected sub-county"
    });
  }

  if (value.issueLicense) {
    if (!value.licenseNo?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["licenseNo"], message: "License number is required" });
    }

    if (!value.licenseType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["licenseType"], message: "License type is required" });
    }

    if (!value.licenseIssuedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["licenseIssuedDate"],
        message: "Issued date is required"
      });
    }

    if (!value.licenseExpiryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["licenseExpiryDate"],
        message: "Expiry date is required"
      });
    }

    if (value.licenseIssuedDate && value.licenseExpiryDate) {
      const issuedDate = new Date(value.licenseIssuedDate);
      const expiryDate = new Date(value.licenseExpiryDate);
      if (expiryDate <= issuedDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["licenseExpiryDate"],
          message: "Expiry date must be later than issued date"
        });
      }
    }
  }
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
    getValues,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FarmerFormValues>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: "",
      subCounty: "Suna East",
      ward: "God Jope",
      farmType: "POND",
      species: "Tilapia",
      productionKg: 0,
      issueLicense: false
    }
  });

  const selectedSubCounty = watch("subCounty");
  const issueLicense = watch("issueLicense");
  const availableWards = WARDS_BY_SUBCOUNTY[selectedSubCounty];

  useEffect(() => {
    const currentWard = getValues("ward");
    if (!availableWards.includes(currentWard)) {
      setValue("ward", availableWards[0], { shouldValidate: true });
    }
  }, [availableWards, getValues, setValue]);

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

      const countyGuess = data.address?.state_district ?? data.address?.county ?? data.address?.municipality ?? "";
      const normalizedGuess = countyGuess.toLowerCase();
      const matchedSubCounty = MIGORI_SUBCOUNTIES.find((item) => normalizedGuess.includes(item.toLowerCase()));

      if (matchedSubCounty) {
        setValue("subCounty", matchedSubCounty, { shouldValidate: true });
        setValue("ward", WARDS_BY_SUBCOUNTY[matchedSubCounty][0], { shouldValidate: true });
      }
    } catch {
      // Best-effort geocoding
    } finally {
      setGeoLoading(false);
    }
  };

  const submitForm = async (values: FarmerFormValues) => {
    await onSubmit({
      name: values.name,
      subCounty: values.subCounty,
      ward: values.ward,
      farmType: values.farmType,
      species: values.species.split(",").map((item) => item.trim()).filter(Boolean),
      productionKg: values.productionKg,
      status: "ACTIVE",
      latitude: location?.lat,
      longitude: location?.lng,
      initialLicense: values.issueLicense
        ? {
            licenseNo: values.licenseNo!.trim(),
            type: values.licenseType!,
            issuedDate: values.licenseIssuedDate!,
            expiryDate: values.licenseExpiryDate!,
            status: "VALID"
          }
        : undefined
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
            <select className="w-full rounded-lg border px-3 py-2 text-sm" {...register("subCounty")}>
              {MIGORI_SUBCOUNTIES.map((subCounty) => (
                <option key={subCounty} value={subCounty}>
                  {subCounty}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Ward</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" {...register("ward")}>
              {availableWards.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
            {errors.ward ? <p className="text-xs text-red-600">{errors.ward.message}</p> : null}
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

          <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <input type="checkbox" className="h-4 w-4" {...register("issueLicense")} />
              Issue initial license now
            </label>

            {issueLicense ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">License Number</label>
                  <Input {...register("licenseNo")} placeholder="MIG-LIC-XXXX" />
                  {errors.licenseNo ? <p className="text-xs text-red-600">{errors.licenseNo.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">License Type</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" {...register("licenseType")}>
                    <option value="">Select type</option>
                    <option value="AQUACULTURE">Aquaculture</option>
                    <option value="COMMERCIAL_FISHING">Commercial Fishing</option>
                    <option value="ARTISANAL_FISHING">Artisanal Fishing</option>
                  </select>
                  {errors.licenseType ? <p className="text-xs text-red-600">{errors.licenseType.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Issued Date</label>
                  <Input type="date" {...register("licenseIssuedDate")} />
                  {errors.licenseIssuedDate ? (
                    <p className="text-xs text-red-600">{errors.licenseIssuedDate.message}</p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Expiry Date</label>
                  <Input type="date" {...register("licenseExpiryDate")} />
                  {errors.licenseExpiryDate ? (
                    <p className="text-xs text-red-600">{errors.licenseExpiryDate.message}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
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
