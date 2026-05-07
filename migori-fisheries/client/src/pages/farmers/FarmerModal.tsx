import { useEffect, useState } from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CreateFarmerPayload } from "@/api/farmers";
import { getWardCoordinates, MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY, type LocationPoint } from "@/lib/locationData";
import type { Farmer } from "@/types";

const farmerSchema = z.object({
  name: z.string().min(2),
  idNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  ageBracket: z.enum(["YOUTH", "ADULT"]).optional(),
  subCounty: z.enum(MIGORI_SUBCOUNTIES),
  ward: z.string().min(2, "Ward is required"),
  farmType: z.enum(["POND", "CAGE", "TANK", "DAM"]),
  status: z.enum(["ACTIVE", "INACTIVE", "PARTIALLY_ACTIVE", "SUSPENDED"]),
  species: z.string().min(2),
  productionKg: z.number().min(0),
  numberOfPonds: z.number().int().min(0),
  activePonds: z.number().int().min(0),
  inactivePonds: z.number().int().min(0),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  issueLicense: z.boolean(),
  licenseNo: z.string().optional(),
  receiptNo: z.string().optional(),
  bmuName: z.string().optional(),
  licenseAmountLicensed: z.number().min(0).optional(),
  licenseType: z.enum([
    "FISH_DEPOT",
    "FISHERMAN",
    "FISH_TRADER",
    "BOAT_OWNER",
    "MOTORIZED_BOAT",
    "NON_MOTORIZED_BOAT",
    "FISH_MOVEMENT_PERMIT",
    "BOAT_LICENSE",
    "NEW_BOARD_REGISTRATION",
    "ICE_PLANT",
    "BOAT"
  ]).optional(),
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

    if (!value.receiptNo?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["receiptNo"], message: "Receipt number is required" });
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

  if (value.farmType === "POND" && value.activePonds + value.inactivePonds > value.numberOfPonds) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["numberOfPonds"],
      message: "Active and inactive ponds cannot exceed total ponds"
    });
  }
});

type FarmerFormValues = z.infer<typeof farmerSchema>;

interface FarmerModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateFarmerPayload) => Promise<void>;
  isSubmitting: boolean;
  canRecordLicense: boolean;
  enforcedSubCounty?: (typeof MIGORI_SUBCOUNTIES)[number];
  initialFarmer?: Farmer | null;
}

const MapPicker = ({ onPick }: { onPick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    }
  });

  return null;
};

const MapAutoFocus = ({ location }: { location: LocationPoint }) => {
  const map = useMap();

  useEffect(() => {
    map.flyTo([location.lat, location.lng], 12, { duration: 0.45 });
  }, [location, map]);

  return (
    <CircleMarker
      center={[location.lat, location.lng]}
      pathOptions={{ color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 0.75, weight: 2 }}
      radius={8}
    />
  );
};

const FarmerModal = ({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  canRecordLicense,
  enforcedSubCounty,
  initialFarmer
}: FarmerModalProps) => {
  const [manualLocation, setManualLocation] = useState<LocationPoint | null>(null);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors }
  } = useForm<FarmerFormValues>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: "",
      gender: undefined,
      ageBracket: undefined,
      subCounty: "Suna East",
      ward: "God Jope",
      farmType: "POND",
      status: "ACTIVE",
      species: "Tilapia",
      productionKg: 0,
      numberOfPonds: 0,
      activePonds: 0,
      inactivePonds: 0,
      issueLicense: false,
      licenseType: "FISHERMAN"
    }
  });

  const selectedSubCounty = useWatch({ control, name: "subCounty", defaultValue: "Suna East" });
  const selectedWard = useWatch({ control, name: "ward", defaultValue: "God Jope" });
  const selectedFarmType = useWatch({ control, name: "farmType", defaultValue: "POND" });
  const issueLicense = useWatch({ control, name: "issueLicense", defaultValue: false });
  const effectiveSubCounty = enforcedSubCounty ?? selectedSubCounty;
  const availableWards = WARDS_BY_SUBCOUNTY[effectiveSubCounty];
  const wardLocation = getWardCoordinates(effectiveSubCounty, selectedWard);
  const selectedLocation = manualLocation ?? wardLocation;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!initialFarmer) {
      return;
    }

    setValue("name", initialFarmer.name);
    setValue("idNumber", initialFarmer.idNumber ?? "");
    setValue("phoneNumber", initialFarmer.phoneNumber ?? "");
    setValue("email", initialFarmer.email ?? "");
    setValue("gender", initialFarmer.gender ?? undefined);
    setValue("ageBracket", initialFarmer.ageBracket ?? undefined);
    setValue("subCounty", initialFarmer.subCounty as (typeof MIGORI_SUBCOUNTIES)[number], { shouldValidate: true });
    setValue("ward", initialFarmer.ward, { shouldValidate: true });
    setValue("farmType", initialFarmer.farmType);
    setValue("status", initialFarmer.status);
    setValue("species", initialFarmer.species.join(", "));
    setValue("productionKg", initialFarmer.productionKg);
    setValue("numberOfPonds", initialFarmer.numberOfPonds);
    setValue("activePonds", initialFarmer.activePonds);
    setValue("inactivePonds", initialFarmer.inactivePonds);
    setManualLocation(
      initialFarmer.latitude != null && initialFarmer.longitude != null
        ? { lat: initialFarmer.latitude, lng: initialFarmer.longitude }
        : null
    );
  }, [initialFarmer, open, setValue]);

  useEffect(() => {
    if (!enforcedSubCounty) {
      return;
    }

    setValue("subCounty", enforcedSubCounty, { shouldValidate: true });
  }, [enforcedSubCounty, setValue]);

  useEffect(() => {
    const currentWard = getValues("ward");
    if (!availableWards.includes(currentWard)) {
      setValue("ward", availableWards[0], { shouldValidate: true });
    }
  }, [availableWards, getValues, setValue]);

  if (!open) {
    return null;
  }

  const submitForm = async (values: FarmerFormValues) => {
    await onSubmit({
      name: values.name,
      idNumber: values.idNumber?.trim() || undefined,
      phoneNumber: values.phoneNumber?.trim() || undefined,
      email: values.email?.trim() || undefined,
      gender: values.gender,
      ageBracket: values.ageBracket,
      subCounty: values.subCounty,
      ward: values.ward,
      farmType: values.farmType,
      status: values.status,
      species: values.species.split(",").map((item) => item.trim()).filter(Boolean),
      productionKg: values.productionKg,
      numberOfPonds: values.farmType === "POND" ? values.numberOfPonds : 0,
      activePonds: values.farmType === "POND" ? values.activePonds : 0,
      inactivePonds: values.farmType === "POND" ? values.inactivePonds : 0,
      latitude: selectedLocation.lat,
      longitude: selectedLocation.lng,
      initialLicense: values.issueLicense
        ? {
            licenseNo: values.licenseNo!.trim(),
            receiptNo: values.receiptNo!.trim(),
            bmuName: values.bmuName?.trim() || undefined,
            amountLicensed: values.licenseAmountLicensed ?? 0,
            type: values.licenseType!,
            issuedDate: values.licenseIssuedDate!,
            expiryDate: values.licenseExpiryDate!
          }
        : undefined
    });
  };

  const handleInvalidSubmit = (formErrors: FieldErrors<FarmerFormValues>) => {
    const firstError = Object.values(formErrors)[0];
    const message = typeof firstError?.message === "string" ? firstError.message : "Check the farmer form details.";
    toast.error(message);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 p-0 sm:grid sm:place-items-center sm:p-4">
      <Card className="h-dvh w-full overflow-hidden rounded-none border-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-lg sm:border">
        <CardContent className="flex h-full flex-col p-0 sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex shrink-0 items-center justify-between border-b bg-card px-4 py-3 sm:px-5">
          <h3 className="text-lg font-semibold">{initialFarmer ? "Edit Farmer" : "Register Farmer"}</h3>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>

        <form
          className="grid flex-1 gap-3 overflow-y-auto px-4 py-4 pb-24 md:grid-cols-2 sm:px-5"
          onSubmit={handleSubmit(submitForm, handleInvalidSubmit)}
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <Input {...register("name")} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ID No.</label>
            <Input {...register("idNumber")} placeholder="National ID / passport" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Phone Number</label>
            <Input {...register("phoneNumber")} placeholder="07..." />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email (optional)</label>
            <Input type="email" {...register("email")} placeholder="name@example.com" />
            {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Gender</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" {...register("gender")}>
              <option value="">Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Age Bracket</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" {...register("ageBracket")}>
              <option value="">Select age bracket</option>
              <option value="ADULT">Adult - Above 35</option>
              <option value="YOUTH">Youth - Below 35</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Sub-County</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...register("subCounty", { onChange: () => setManualLocation(null) })}
              disabled={Boolean(enforcedSubCounty)}
            >
              {MIGORI_SUBCOUNTIES.map((subCounty) => (
                <option key={subCounty} value={subCounty}>
                  {subCounty}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Ward</label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              {...register("ward", { onChange: () => setManualLocation(null) })}
            >
              {availableWards.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
            {errors.ward ? <p className="text-xs text-red-600">{errors.ward.message}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Production Unit</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" {...register("farmType")}>
              <option value="POND">Pond</option>
              <option value="CAGE">Cage</option>
              <option value="TANK">Tank</option>
              <option value="DAM">Dam</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Status of the Farm</label>
            <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm" {...register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PARTIALLY_ACTIVE">Partially Active</option>
              <option value="SUSPENDED">Suspended</option>
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

            {selectedFarmType === "POND" ? (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:col-span-2 md:grid-cols-3">
              <div className="md:col-span-3">
                <p className="text-sm font-medium">Production Unit Details</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Number of Production Units</label>
                <Input type="number" min="0" step="1" {...register("numberOfPonds", { valueAsNumber: true })} />
                {errors.numberOfPonds ? <p className="text-xs text-red-600">{errors.numberOfPonds.message}</p> : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Number Active</label>
                <Input type="number" min="0" step="1" {...register("activePonds", { valueAsNumber: true })} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Number Inactive</label>
                <Input type="number" min="0" step="1" {...register("inactivePonds", { valueAsNumber: true })} />
              </div>
            </div>
            ) : null}

          {canRecordLicense && !initialFarmer ? (
          <div className="md:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
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
                  <label className="mb-1 block text-sm font-medium">Receipt Number</label>
                  <Input {...register("receiptNo")} placeholder="RCT-XXXX" />
                  {errors.receiptNo ? <p className="text-xs text-red-600">{errors.receiptNo.message}</p> : null}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">BMU</label>
                  <Input {...register("bmuName")} placeholder="BMU name" />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Amount Licensed (KES)</label>
                  <Input type="number" min="0" step="0.01" {...register("licenseAmountLicensed", { valueAsNumber: true })} />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">License Type</label>
                  <select className="w-full rounded-lg border px-3 py-2 text-sm" {...register("licenseType")}>
                    <option value="">Select type</option>
                    <option value="FISH_DEPOT">Fish Depot</option>
                    <option value="FISHERMAN">Fisherman's License</option>
                    <option value="FISH_TRADER">Fish Trader License</option>
                    <option value="BOAT_OWNER">Boat Owner License</option>
                    <option value="MOTORIZED_BOAT">Motorized Boat</option>
                    <option value="NON_MOTORIZED_BOAT">Non Motorized Boat</option>
                    <option value="FISH_MOVEMENT_PERMIT">Fish Movement Permit</option>
                    <option value="BOAT_LICENSE">Boat License</option>
                    <option value="NEW_BOARD_REGISTRATION">New Board Registration License</option>
                    <option value="ICE_PLANT">Ice Plant License</option>
                    <option value="BOAT">Boat Licensing</option>
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
          ) : null}

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium">Farm Geolocation</p>
            <div className="h-48 overflow-hidden rounded-lg border">
              <MapContainer center={[selectedLocation.lat, selectedLocation.lng]} zoom={12} className="h-full w-full">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                />
                <MapAutoFocus location={selectedLocation} />
                <MapPicker
                  onPick={(lat, lng) => {
                    setManualLocation({ lat, lng });
                  }}
                />
              </MapContainer>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Selected: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)} for {selectedWard},{" "}
              {effectiveSubCounty}
            </p>
          </div>

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-card px-4 py-3 md:col-span-2 sm:-mx-5 sm:px-5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : initialFarmer ? "Update Farmer" : "Save Farmer"}
            </Button>
          </div>
        </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default FarmerModal;
