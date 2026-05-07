import { useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  captureFisheriesApi,
  type CreateCageProductionPayload,
  type CreateCaptureFisheriesPayload
} from "@/api/captureFisheries";
import { useCaptureFisheries } from "@/hooks/useCaptureFisheries";
import { useAuthStore } from "@/store/authStore";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY } from "@/lib/locationData";
import { CAPTURE_SPECIES, NYATIKE_BEACHES, NYATIKE_SUBCOUNTY } from "@/lib/nyatikeBeaches";
import { getSearchEmptyLabel } from "@/lib/search";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { CageProductionRecord, CaptureFisheriesRecord } from "@/types";

type CaptureForm = {
  extensionOfficerName: string;
  extensionOfficerPhone: string;
  fisherName: string;
  farmerNumber: string;
  idNumber: string;
  phoneNumber: string;
  subCounty: (typeof MIGORI_SUBCOUNTIES)[number];
  ward: string;
  gender: "MALE" | "FEMALE";
  ageBracket: "YOUTH" | "ADULT";
  topics: string;
  latitude?: number;
  longitude?: number;
  bmuName: string;
  landingSite: string;
  species: string;
  catchKg: number;
  value: number;
  month: number;
  year: number;
  effortHours?: number;
};

type CageProductionForm = {
  farmerUniqueId: string;
  farmerName: string;
  phoneNumber: string;
  idNumber: string;
  bmuLocation: string;
  cageIdentifier: string;
  fishSpecies: "Tilapia";
  subCounty: (typeof MIGORI_SUBCOUNTIES)[number];
  ward: string;
  numberOfCages: number;
  activeCages: number;
  inactiveCages: number;
  fingerlingsStocked: number;
  stockingDate: string;
  feedTypes: Array<"Mash" | "Pellets">;
  feedQuantityKg: number;
  averageFishWeightKg: number;
  mortalityPieces: number;
  quantityHarvestedKg: number;
  numberHarvestedPieces: number;
  harvestDate: string;
  extensionOfficerName: string;
  remarks: string;
  month: number;
  year: number;
};

type PendingAction = {
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
} | null;

const currentDate = new Date();

const FormField = ({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) => (
  <label className={`block space-y-1 ${className}`}>
    <span className="text-sm font-medium text-foreground">{label}</span>
    {children}
  </label>
);

const getValidNyatikeBeachForWard = (ward: string, beachName?: string | null): string => {
  const wardBeaches = NYATIKE_BEACHES.filter((beach) => beach.ward === ward);
  const matchingBeach = wardBeaches.find((beach) => beach.name === beachName);
  return matchingBeach?.name ?? wardBeaches[0]?.name ?? "";
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as AxiosError<{ error?: string; issues?: Array<{ path?: string; message?: string }> }>).response?.data;
  const issueMessage = response?.issues?.[0];

  if (issueMessage?.message) {
    return issueMessage.path ? `${issueMessage.path}: ${issueMessage.message}` : issueMessage.message;
  }

  return response?.error ?? fallback;
};

const captureFisheriesExportColumns = [
  { header: "Unique Number", value: "captureCode" },
  { header: "Name", value: "fisherName" },
  { header: "Phone", value: (record: CaptureFisheriesRecord) => record.phoneNumber ?? "" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: "ward" },
  { header: "Beach", value: (record: CaptureFisheriesRecord) => record.landingSite ?? "" },
  { header: "Month", value: (record: CaptureFisheriesRecord) => record.month ?? "" },
  { header: "Year", value: (record: CaptureFisheriesRecord) => record.year ?? "" },
  { header: "Quantity Harvested (Kg)", value: "catchKg" },
  { header: "Gender", value: "gender" },
  { header: "Age Bracket", value: "ageBracket" },
  { header: "Topics", value: (record: CaptureFisheriesRecord) => record.topics.join(", ") }
] satisfies Array<ExcelColumn<CaptureFisheriesRecord>>;

const cageProductionExportColumns = [
  { header: "Unique Number", value: "cageCode" },
  { header: "Farmer Name", value: "farmerName" },
  { header: "Contact Information", value: (record: CageProductionRecord) => record.phoneNumber ?? "" },
  { header: "BMU/Location", value: (record: CageProductionRecord) => record.bmuLocation ?? "" },
  { header: "Cage ID", value: (record: CageProductionRecord) => record.cageIdentifier ?? record.farmerUniqueId },
  { header: "Fish Species", value: "fishSpecies" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: "ward" },
  { header: "Fingerlings Stocked", value: "fingerlingsStocked" },
  { header: "Date of Stocking", value: (record: CageProductionRecord) => record.stockingDate ? new Date(record.stockingDate) : "" },
  { header: "Feed Type", value: (record: CageProductionRecord) => record.feedTypes.join(", ") },
  { header: "Feed Quantity Used (Kg)", value: "feedQuantityKg" },
  { header: "Average Fish Weight (Kg)", value: "averageFishWeightKg" },
  { header: "Mortality (PCS)", value: "mortalityPieces" },
  { header: "Quantity Harvested (Kg)", value: "quantityHarvestedKg" },
  { header: "Number Harvested (PCs)", value: "numberHarvestedPieces" },
  { header: "Date of Harvest", value: (record: CageProductionRecord) => record.harvestDate ? new Date(record.harvestDate) : "" },
  { header: "Extension Officer Name", value: (record: CageProductionRecord) => record.extensionOfficerName ?? "" },
  { header: "Remarks/Recommendations", value: (record: CageProductionRecord) => record.remarks ?? "" }
] satisfies Array<ExcelColumn<CageProductionRecord>>;

const CaptureFisheriesPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { data: records = [], isLoading } = useCaptureFisheries();
  const { data: cageProductionRecords = [], isLoading: isLoadingCageProduction } = useQuery({
    queryKey: ["capture-fisheries", "cage-production"],
    queryFn: captureFisheriesApi.listCageProduction
  });
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingCageRecordId, setEditingCageRecordId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cageSearchTerm, setCageSearchTerm] = useState("");
  const [captureSubCountyFilter, setCaptureSubCountyFilter] = useState("ALL");
  const [captureYearFilter, setCaptureYearFilter] = useState("ALL");
  const [cageSubCountyFilter, setCageSubCountyFilter] = useState("ALL");
  const [cageYearFilter, setCageYearFilter] = useState("ALL");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const enforcedSubCounty =
    user?.role === "FISHERIES_OFFICER" && user.subCounty && MIGORI_SUBCOUNTIES.includes(user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      ? (user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      : undefined;

  const canRecord =
    (user?.role === "FISHERIES_OFFICER" && enforcedSubCounty === NYATIKE_SUBCOUNTY) ||
    user?.role === "DIRECTOR" ||
    user?.role === "ADMIN";
  const canApprove =
    user?.role === "DIRECTOR" || user?.role === "ADMIN" || (user?.role === "FISHERIES_OFFICER" && enforcedSubCounty === NYATIKE_SUBCOUNTY);
  const canEditOrDelete = user?.role === "DIRECTOR" || user?.role === "ADMIN" || user?.role === "FISHERIES_OFFICER";

  const { register, handleSubmit, reset, control, setValue } = useForm<CaptureForm>({
    defaultValues: {
      extensionOfficerName: user?.name ?? "",
      extensionOfficerPhone: "",
      fisherName: "",
      farmerNumber: "",
      idNumber: "",
      phoneNumber: "",
      subCounty: NYATIKE_SUBCOUNTY,
      ward: "Got Kachola",
      gender: "MALE",
      ageBracket: "ADULT",
      topics: "",
      latitude: undefined,
      longitude: undefined,
      bmuName: "",
      landingSite: NYATIKE_BEACHES[0].name,
      species: CAPTURE_SPECIES[0],
      catchKg: 0,
      value: 0,
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      effortHours: undefined
    }
  });

  const selectedSubCounty = useWatch({
    control,
    name: "subCounty",
    defaultValue: NYATIKE_SUBCOUNTY
  });
  const availableWards = useMemo(() => WARDS_BY_SUBCOUNTY[selectedSubCounty], [selectedSubCounty]);
  const selectedCaptureWard = useWatch({ control, name: "ward", defaultValue: "Got Kachola" });
  const availableBeaches = useMemo(
    () => NYATIKE_BEACHES.filter((beach) => beach.ward === selectedCaptureWard),
    [selectedCaptureWard]
  );

  const {
    register: registerCage,
    handleSubmit: handleCageSubmit,
    reset: resetCage,
    control: cageControl,
    setValue: setCageValue
  } = useForm<CageProductionForm>({
    defaultValues: {
      farmerUniqueId: "",
      farmerName: "",
      phoneNumber: "",
      idNumber: "",
      bmuLocation: "",
      cageIdentifier: "",
      fishSpecies: "Tilapia",
      subCounty: (enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number],
      ward: WARDS_BY_SUBCOUNTY[(enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number]][0],
      numberOfCages: 0,
      activeCages: 0,
      inactiveCages: 0,
      fingerlingsStocked: 0,
      stockingDate: new Date().toISOString().slice(0, 10),
      feedTypes: ["Pellets"],
      feedQuantityKg: 0,
      averageFishWeightKg: 0,
      mortalityPieces: 0,
      quantityHarvestedKg: 0,
      numberHarvestedPieces: 0,
      harvestDate: "",
      extensionOfficerName: user?.name ?? "",
      remarks: "",
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear()
    }
  });

  const selectedCageSubCounty = useWatch({
    control: cageControl,
    name: "subCounty",
    defaultValue: (enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number]
  });
  const availableCageWards = useMemo(() => WARDS_BY_SUBCOUNTY[selectedCageSubCounty], [selectedCageSubCounty]);

  const createRecord = useMutation({
    mutationFn: (payload: CreateCaptureFisheriesPayload) => captureFisheriesApi.create(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["capture-fisheries"] })
  });

  const updateRecord = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCaptureFisheriesPayload> }) =>
      captureFisheriesApi.update(id, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["capture-fisheries"] })
  });

  const deleteRecord = useMutation({
    mutationFn: captureFisheriesApi.remove,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["capture-fisheries"] })
  });

  const approveRecord = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" }) =>
      captureFisheriesApi.updateApproval(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["capture-fisheries"] })
  });

  const createCageRecord = useMutation({
    mutationFn: (payload: CreateCageProductionPayload) => captureFisheriesApi.createCageProduction(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["capture-fisheries", "cage-production"] })
  });

  const updateCageRecord = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCageProductionPayload> }) =>
      captureFisheriesApi.updateCageProduction(id, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["capture-fisheries", "cage-production"] })
  });

  const deleteCageRecord = useMutation({
    mutationFn: captureFisheriesApi.removeCageProduction,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["capture-fisheries", "cage-production"] })
  });

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSubCounty = captureSubCountyFilter === "ALL" || record.subCounty === captureSubCountyFilter;
      const matchesYear = captureYearFilter === "ALL" || String(record.year ?? "") === captureYearFilter;
      const matchesSearch =
        !term ||
        [
          record.captureCode,
          record.extensionOfficerName,
          record.extensionOfficerPhone,
          record.fisherName,
          record.farmerNumber ?? "",
          record.idNumber ?? "",
          record.phoneNumber ?? "",
          record.subCounty,
          record.ward,
          record.bmuName ?? "",
          record.landingSite ?? "",
          record.species,
          record.topics.join(", "),
          record.gender,
          record.ageBracket,
          record.approvalStatus,
          String(record.month ?? ""),
          String(record.year ?? ""),
          String(record.catchKg)
        ].some((value) => value.toLowerCase().includes(term));

      return matchesSubCounty && matchesYear && matchesSearch;
    });
  }, [records, searchTerm, captureSubCountyFilter, captureYearFilter]);

  const filteredCageRecords = useMemo(() => {
    const term = cageSearchTerm.trim().toLowerCase();

    return cageProductionRecords.filter((record) => {
      const matchesSubCounty = cageSubCountyFilter === "ALL" || record.subCounty === cageSubCountyFilter;
      const matchesYear = cageYearFilter === "ALL" || String(record.year) === cageYearFilter;
      const matchesSearch =
        !term ||
        [
          record.cageCode,
          record.farmerUniqueId,
          record.farmerName,
          record.phoneNumber ?? "",
          record.idNumber ?? "",
          record.bmuLocation ?? "",
          record.cageIdentifier ?? "",
          record.fishSpecies,
          record.subCounty,
          record.ward,
          record.feedTypes.join(", "),
          record.extensionOfficerName ?? "",
          record.remarks ?? "",
          String(record.numberOfCages),
          String(record.activeCages),
          String(record.inactiveCages),
          String(record.fingerlingsStocked),
          String(record.feedQuantityKg),
          String(record.averageFishWeightKg),
          String(record.mortalityPieces),
          String(record.quantityHarvestedKg),
          String(record.numberHarvestedPieces),
          String(record.month),
          String(record.year)
        ].some((value) => value.toLowerCase().includes(term));

      return matchesSubCounty && matchesYear && matchesSearch;
    });
  }, [cageProductionRecords, cageSearchTerm, cageSubCountyFilter, cageYearFilter]);

  const captureYearOptions = useMemo(
    () => Array.from(new Set(records.map((record) => record.year).filter((year): year is number => typeof year === "number"))).sort((a, b) => b - a),
    [records]
  );

  const cageYearOptions = useMemo(
    () => Array.from(new Set(cageProductionRecords.map((record) => record.year))).sort((a, b) => b - a),
    [cageProductionRecords]
  );

  const mapFormToPayload = (values: CaptureForm): CreateCaptureFisheriesPayload => ({
    extensionOfficerName: values.extensionOfficerName.trim(),
    extensionOfficerPhone: values.extensionOfficerPhone.trim() || undefined,
    fisherName: values.fisherName.trim(),
    farmerNumber: values.farmerNumber.trim() || undefined,
    idNumber: values.idNumber.trim() || undefined,
    phoneNumber: values.phoneNumber.trim(),
    subCounty: values.subCounty,
    ward: values.ward,
    gender: values.gender,
    ageBracket: values.ageBracket,
    topics: values.topics.split(",").map((topic) => topic.trim()).filter(Boolean),
    latitude: values.latitude,
    longitude: values.longitude,
    bmuName: values.bmuName.trim() || undefined,
    landingSite: values.landingSite.trim() || undefined,
    species: values.species.trim(),
    catchKg: Number(values.catchKg),
    value: Number(values.value),
    month: Number(values.month),
    year: Number(values.year),
    fishingDate: new Date(Number(values.year), Number(values.month) - 1, 1).toISOString(),
    effortHours: values.effortHours ? Number(values.effortHours) : undefined
  });

  const resetForm = () => {
    reset({
      extensionOfficerName: user?.name ?? "",
      extensionOfficerPhone: "",
      fisherName: "",
      farmerNumber: "",
      idNumber: "",
      phoneNumber: "",
      subCounty: NYATIKE_SUBCOUNTY,
      ward: "Got Kachola",
      gender: "MALE",
      ageBracket: "ADULT",
      topics: "",
      latitude: undefined,
      longitude: undefined,
      bmuName: "",
      landingSite: NYATIKE_BEACHES[0].name,
      species: CAPTURE_SPECIES[0],
      catchKg: 0,
      value: 0,
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      effortHours: undefined
    });
    setEditingRecordId(null);
  };

  const mapCageFormToPayload = (values: CageProductionForm): CreateCageProductionPayload => ({
    farmerUniqueId: values.farmerUniqueId.trim() || values.cageIdentifier.trim(),
    farmerName: values.farmerName.trim(),
    phoneNumber: values.phoneNumber.trim() || undefined,
    idNumber: values.idNumber.trim() || undefined,
    bmuLocation: values.bmuLocation.trim() || undefined,
    cageIdentifier: values.cageIdentifier.trim(),
    fishSpecies: "Tilapia",
    subCounty: values.subCounty,
    ward: values.ward,
    numberOfCages: Number(values.numberOfCages),
    activeCages: Number(values.activeCages),
    inactiveCages: Number(values.inactiveCages),
    fingerlingsStocked: Number(values.fingerlingsStocked),
    stockingDate: values.stockingDate ? new Date(values.stockingDate).toISOString() : undefined,
    feedTypes: values.feedTypes,
    feedQuantityKg: Number(values.feedQuantityKg),
    averageFishWeightKg: Number(values.averageFishWeightKg),
    mortalityPieces: Number(values.mortalityPieces),
    quantityHarvestedKg: Number(values.quantityHarvestedKg),
    numberHarvestedPieces: Number(values.numberHarvestedPieces),
    harvestDate: values.harvestDate ? new Date(values.harvestDate).toISOString() : undefined,
    extensionOfficerName: values.extensionOfficerName.trim() || undefined,
    remarks: values.remarks.trim() || undefined,
    month: Number(values.month),
    year: Number(values.year)
  });

  const resetCageForm = (subCounty: (typeof MIGORI_SUBCOUNTIES)[number]) => {
    resetCage({
      farmerUniqueId: "",
      farmerName: "",
      phoneNumber: "",
      idNumber: "",
      bmuLocation: "",
      cageIdentifier: "",
      fishSpecies: "Tilapia",
      subCounty,
      ward: WARDS_BY_SUBCOUNTY[subCounty][0],
      numberOfCages: 0,
      activeCages: 0,
      inactiveCages: 0,
      fingerlingsStocked: 0,
      stockingDate: new Date().toISOString().slice(0, 10),
      feedTypes: ["Pellets"],
      feedQuantityKg: 0,
      averageFishWeightKg: 0,
      mortalityPieces: 0,
      quantityHarvestedKg: 0,
      numberHarvestedPieces: 0,
      harvestDate: "",
      extensionOfficerName: user?.name ?? "",
      remarks: "",
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear()
    });
    setEditingCageRecordId(null);
  };

  const submitRecord = async (values: CaptureForm) => {
    try {
      const payload = mapFormToPayload(values);
      if (editingRecordId) {
        await updateRecord.mutateAsync({ id: editingRecordId, payload });
        toast.success("Capture entry updated");
      } else {
        await createRecord.mutateAsync(payload);
        toast.success("Capture entry saved");
      }
      resetForm();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to save capture entry."));
    }
  };

  const submitCageRecord = async (values: CageProductionForm) => {
    try {
      const payload = mapCageFormToPayload(values);
      if (editingCageRecordId) {
        await updateCageRecord.mutateAsync({ id: editingCageRecordId, payload });
        toast.success("Cage production entry updated");
      } else {
        await createCageRecord.mutateAsync(payload);
        toast.success("Cage production entry saved");
      }
      resetCageForm((enforcedSubCounty ?? values.subCounty) as (typeof MIGORI_SUBCOUNTIES)[number]);
    } catch (error) {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ??
        "Failed to save cage production entry.";
      toast.error(message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Capture Fisheries Data Entry</h1>
          <p className="text-sm text-muted-foreground">
            Includes extension registry details plus cage production tracking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search capture entries..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={captureSubCountyFilter}
            onChange={(event) => setCaptureSubCountyFilter(event.target.value)}
            disabled={Boolean(enforcedSubCounty)}
          >
            <option value="ALL">All sub-counties</option>
            {(enforcedSubCounty ? [enforcedSubCounty] : MIGORI_SUBCOUNTIES).map((subCounty) => (
              <option key={subCounty} value={subCounty}>
                {subCounty}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={captureYearFilter}
            onChange={(event) => setCaptureYearFilter(event.target.value)}
          >
            <option value="ALL">All years</option>
            {captureYearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ExportButton filename="capture-fisheries" sheetName="Capture Fisheries" columns={captureFisheriesExportColumns} rows={filteredRecords} />
        </div>
      </div>

      {canRecord ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingRecordId ? "Edit Wild Catch Entry" : "Add Wild Catch Entry"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitRecord)}>
              <FormField label="Name">
                <Input placeholder="Name of fisher or trader" {...register("fisherName", { required: true })} />
              </FormField>
              <FormField label="Phone">
                <Input placeholder="e.g. 0712345678" {...register("phoneNumber", { required: true })} />
              </FormField>

              <FormField label="Sub-County">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("subCounty", {
                    required: true,
                    onChange: (event) =>
                      setValue("ward", WARDS_BY_SUBCOUNTY[event.target.value as (typeof MIGORI_SUBCOUNTIES)[number]][0])
                  })}
                  disabled
                >
                  <option value={NYATIKE_SUBCOUNTY}>{NYATIKE_SUBCOUNTY}</option>
                </select>
              </FormField>

              <FormField label="Ward">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("ward", {
                    required: true,
                    onChange: (event) => {
                      const firstBeach = NYATIKE_BEACHES.find((beach) => beach.ward === event.target.value);
                      setValue("landingSite", firstBeach?.name ?? "");
                    }
                  })}
                >
                  {availableWards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Beach">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("landingSite", { required: true })}>
                  {availableBeaches.map((beach) => (
                    <option key={beach.name} value={beach.name}>
                      {beach.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Species Captured">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("species", { required: true })}>
                  {CAPTURE_SPECIES.map((species) => (
                    <option key={species} value={species}>
                      {species}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Reporting Month">
                <Input type="number" min="1" max="12" placeholder="1 to 12" {...register("month", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Reporting Year">
                <Input type="number" min="2000" max="2100" placeholder="e.g. 2026" {...register("year", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Quantity Harvested (Kg)">
                <Input type="number" step="0.1" placeholder="0" {...register("catchKg", { valueAsNumber: true })} />
              </FormField>

              <FormField label="Sub-County Fisheries Officer Name">
                <Input placeholder="Officer responsible for this entry" {...register("extensionOfficerName", { required: true })} />
              </FormField>

              <div className="md:col-span-3 flex justify-end gap-2">
                {editingRecordId ? (
                  <Button type="button" variant="outline" onClick={() => resetForm()}>
                    Cancel Edit
                  </Button>
                ) : null}
                <Button type="submit" disabled={createRecord.isPending || updateRecord.isPending}>
                  {createRecord.isPending || updateRecord.isPending ? "Saving..." : editingRecordId ? "Update Entry" : "Save Entry"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Capture data entry is available to fisheries officers with assigned sub-county and directors.
        </div>
      )}

      <DataTable
        headers={[
          "Unique No",
          "Name",
          "Phone",
          "Sub-County",
          "Ward",
          "Beach",
          "Species",
          "Month",
          "Year",
          "Harvested (Kg)",
          "Approval",
          "Actions"
        ]}
        rows={filteredRecords.map((record) => [
          record.captureCode,
          record.fisherName,
          record.phoneNumber ?? "-",
          record.subCounty,
          record.ward,
          record.landingSite ?? "-",
          record.species,
          record.month?.toString() ?? "-",
          record.year?.toString() ?? "-",
          record.catchKg.toLocaleString(),
          <StatusBadge key={`${record.id}-status`} status={record.approvalStatus} />,
          <div key={`${record.id}-actions`} className="flex gap-2">
            {canEditOrDelete ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingRecordId(record.id);
                    setValue("extensionOfficerName", record.extensionOfficerName);
                    setValue("extensionOfficerPhone", record.extensionOfficerPhone);
                    setValue("fisherName", record.fisherName);
                    setValue("farmerNumber", record.farmerNumber ?? "");
                    setValue("idNumber", record.idNumber ?? "");
                    setValue("phoneNumber", record.phoneNumber ?? "");
                    setValue("subCounty", record.subCounty as (typeof MIGORI_SUBCOUNTIES)[number]);
                    const validLandingSite = getValidNyatikeBeachForWard(record.ward, record.landingSite);
                    setValue("ward", record.ward);
                    setValue("gender", record.gender);
                    setValue("ageBracket", record.ageBracket);
                    setValue("topics", record.topics.join(", "));
                    setValue("latitude", record.latitude ?? undefined);
                    setValue("longitude", record.longitude ?? undefined);
                    setValue("bmuName", record.bmuName ?? "");
                    setValue("landingSite", validLandingSite);
                    setValue("species", record.species);
                    setValue("catchKg", record.catchKg);
                    setValue("value", record.value);
                    setValue("month", record.month ?? currentDate.getMonth() + 1);
                    setValue("year", record.year ?? currentDate.getFullYear());
                    setValue("effortHours", record.effortHours ?? undefined);
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deleteRecord.isPending}
                  onClick={() => {
                    setPendingAction({
                      title: "Delete capture entry?",
                      message: `This will permanently delete ${record.captureCode}.`,
                      onConfirm: async () => {
                        try {
                          await deleteRecord.mutateAsync(record.id);
                          toast.success("Entry deleted");
                        } catch (error) {
                          const message =
                            (error as AxiosError<{ error?: string }>).response?.data?.error ??
                            "Failed to delete entry.";
                          toast.error(message);
                        }
                      }
                    });
                  }}
                >
                  Delete
                </Button>
              </>
            ) : null}
            {canApprove ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={approveRecord.isPending || record.approvalStatus === "APPROVED"}
                  onClick={() => {
                    setPendingAction({
                      title: "Validate capture entry?",
                      message: `This will mark ${record.captureCode} as approved/validated.`,
                      onConfirm: async () => {
                        try {
                          await approveRecord.mutateAsync({ id: record.id, status: "APPROVED" });
                          toast.success("Entry approved");
                        } catch (error) {
                          const message =
                            (error as AxiosError<{ error?: string }>).response?.data?.error ??
                            "Failed to approve entry.";
                          toast.error(message);
                        }
                      }
                    });
                  }}
                >
                  ✅ Validate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={approveRecord.isPending || record.approvalStatus === "REJECTED"}
                  onClick={() => {
                    setPendingAction({
                      title: "Reject capture entry?",
                      message: `This will reject ${record.captureCode}.`,
                      onConfirm: async () => {
                        try {
                          await approveRecord.mutateAsync({ id: record.id, status: "REJECTED" });
                          toast.success("Entry rejected");
                        } catch (error) {
                          const message =
                            (error as AxiosError<{ error?: string }>).response?.data?.error ??
                            "Failed to reject entry.";
                          toast.error(message);
                        }
                      }
                    });
                  }}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </div>
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm: searchTerm || (captureSubCountyFilter !== "ALL" || captureYearFilter !== "ALL" ? "selected filters" : ""),
          isLoading,
          loadingLabel: "Loading capture fisheries records...",
          emptyLabel: "No capture fisheries records found."
        })}
      />

      <div className="flex flex-wrap items-start justify-between gap-3 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Cage Production</h2>
          <p className="text-sm text-muted-foreground">
            Monitor farmer cage stocking and harvested production by month and year.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={cageSearchTerm}
            onChange={(event) => setCageSearchTerm(event.target.value)}
            placeholder="Search cage production..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={cageSubCountyFilter}
            onChange={(event) => setCageSubCountyFilter(event.target.value)}
            disabled={Boolean(enforcedSubCounty)}
          >
            <option value="ALL">All sub-counties</option>
            {(enforcedSubCounty ? [enforcedSubCounty] : MIGORI_SUBCOUNTIES).map((subCounty) => (
              <option key={subCounty} value={subCounty}>
                {subCounty}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={cageYearFilter}
            onChange={(event) => setCageYearFilter(event.target.value)}
          >
            <option value="ALL">All years</option>
            {cageYearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <ExportButton
            filename="cage-production"
            sheetName="Cage Production"
            columns={cageProductionExportColumns}
            rows={filteredCageRecords}
          />
        </div>
      </div>

      {canRecord ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingCageRecordId ? "Edit Cage Production Entry" : "Add Cage Production Entry"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleCageSubmit(submitCageRecord)}>
              <FormField label="Farmer Name">
                <Input placeholder="Full name of cage farmer" {...registerCage("farmerName", { required: true })} />
              </FormField>
              <FormField label="Contact Information">
                <Input placeholder="Phone number or contact details" {...registerCage("phoneNumber")} />
              </FormField>
              <FormField label="BMU/Location">
                <Input placeholder="BMU or cage location" {...registerCage("bmuLocation")} />
              </FormField>
              <FormField label="Cage ID">
                <Input placeholder="e.g. CAGE-NYA-001" {...registerCage("cageIdentifier", { required: true })} />
              </FormField>
              <FormField label="Fish Species">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...registerCage("fishSpecies", { required: true })}>
                  <option value="Tilapia">Tilapia</option>
                </select>
              </FormField>
              <FormField label="Sub-County">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...registerCage("subCounty", {
                    required: true,
                    onChange: (event) =>
                      setCageValue("ward", WARDS_BY_SUBCOUNTY[event.target.value as (typeof MIGORI_SUBCOUNTIES)[number]][0])
                  })}
                  disabled={Boolean(enforcedSubCounty)}
                >
                  {MIGORI_SUBCOUNTIES.map((subCounty) => (
                    <option key={subCounty} value={subCounty}>
                      {subCounty}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Ward">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...registerCage("ward", { required: true })}>
                  {availableCageWards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Fingerlings Stocked">
                <Input type="number" min="0" placeholder="Number of fingerlings stocked" {...registerCage("fingerlingsStocked", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Date of Stocking">
                <Input type="date" {...registerCage("stockingDate")} />
              </FormField>
              <div className="space-y-1">
                <span className="text-sm font-medium text-foreground">Feed Type</span>
                <div className="flex h-10 items-center gap-4 rounded-md border border-input bg-background px-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" value="Mash" {...registerCage("feedTypes", { required: true })} />
                    Mash
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" value="Pellets" {...registerCage("feedTypes", { required: true })} />
                    Pellets
                  </label>
                </div>
              </div>
              <FormField label="Feed Quantity Used (Kg)">
                <Input type="number" step="0.1" min="0" placeholder="Feed used in kilograms" {...registerCage("feedQuantityKg", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Average Fish Weight (Kg)">
                <Input type="number" step="0.01" min="0" placeholder="Average weight per fish" {...registerCage("averageFishWeightKg", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Mortality (PCS)">
                <Input type="number" min="0" placeholder="Number of fish lost" {...registerCage("mortalityPieces", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Quantity Harvested (Kg)">
                <Input type="number" step="0.1" min="0" placeholder="Harvested quantity in kilograms" {...registerCage("quantityHarvestedKg", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Number Harvested (PCs)">
                <Input type="number" min="0" placeholder="Number of fish harvested" {...registerCage("numberHarvestedPieces", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Date of Harvest">
                <Input type="date" {...registerCage("harvestDate")} />
              </FormField>
              <FormField label="Reporting Month">
                <Input type="number" min="1" max="12" placeholder="1 to 12" {...registerCage("month", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Reporting Year">
                <Input type="number" min="2000" max="2100" placeholder="e.g. 2026" {...registerCage("year", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Extension Officer Name">
                <Input placeholder="Officer responsible for this entry" {...registerCage("extensionOfficerName")} />
              </FormField>
              <FormField label="Remarks/Recommendations" className="md:col-span-3">
                <Input placeholder="Recommendations, remarks, or follow-up notes" {...registerCage("remarks")} />
              </FormField>

              <div className="md:col-span-3 flex justify-end gap-2">
                {editingCageRecordId ? (
                  <Button type="button" variant="outline" onClick={() => resetCageForm((enforcedSubCounty ?? selectedCageSubCounty) as (typeof MIGORI_SUBCOUNTIES)[number])}>
                    Cancel Edit
                  </Button>
                ) : null}
                <Button type="submit" disabled={createCageRecord.isPending || updateCageRecord.isPending}>
                  {createCageRecord.isPending || updateCageRecord.isPending
                    ? "Saving..."
                    : editingCageRecordId
                      ? "Update Cage Entry"
                      : "Save Cage Entry"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        headers={[
          "Unique No",
          "Farmer Name",
          "Contact",
          "BMU/Location",
          "Cage ID",
          "Species",
          "Sub-County",
          "Ward",
          "Fingerlings",
          "Stocking Date",
          "Feed Type",
          "Feed Qty (Kg)",
          "Avg Weight (Kg)",
          "Mortality",
          "Harvested (Kg)",
          "Harvested (PCs)",
          "Harvest Date",
          "Officer",
          "Month",
          "Year",
          "Actions"
        ]}
        rows={filteredCageRecords.map((record) => [
          record.cageCode,
          record.farmerName,
          record.phoneNumber ?? "-",
          record.bmuLocation ?? "-",
          record.cageIdentifier ?? record.farmerUniqueId,
          record.fishSpecies,
          record.subCounty,
          record.ward,
          record.fingerlingsStocked.toLocaleString(),
          record.stockingDate ? new Date(record.stockingDate).toLocaleDateString() : "-",
          record.feedTypes.length > 0 ? record.feedTypes.join(", ") : "-",
          record.feedQuantityKg.toLocaleString(),
          record.averageFishWeightKg.toLocaleString(),
          record.mortalityPieces.toLocaleString(),
          record.quantityHarvestedKg.toLocaleString(),
          record.numberHarvestedPieces.toLocaleString(),
          record.harvestDate ? new Date(record.harvestDate).toLocaleDateString() : "-",
          record.extensionOfficerName ?? "-",
          record.month.toString(),
          record.year.toString(),
          canEditOrDelete ? (
            <div key={`${record.id}-cage-actions`} className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingCageRecordId(record.id);
                  setCageValue("farmerUniqueId", record.farmerUniqueId);
                  setCageValue("farmerName", record.farmerName);
                  setCageValue("phoneNumber", record.phoneNumber ?? "");
                  setCageValue("idNumber", record.idNumber ?? "");
                  setCageValue("bmuLocation", record.bmuLocation ?? "");
                  setCageValue("cageIdentifier", record.cageIdentifier ?? record.farmerUniqueId);
                  setCageValue("fishSpecies", record.fishSpecies);
                  setCageValue("subCounty", record.subCounty as (typeof MIGORI_SUBCOUNTIES)[number]);
                  setCageValue("ward", record.ward);
                  setCageValue("numberOfCages", record.numberOfCages);
                  setCageValue("activeCages", record.activeCages);
                  setCageValue("inactiveCages", record.inactiveCages);
                  setCageValue("fingerlingsStocked", record.fingerlingsStocked);
                  setCageValue("stockingDate", record.stockingDate ? record.stockingDate.slice(0, 10) : "");
                  setCageValue("feedTypes", record.feedTypes);
                  setCageValue("feedQuantityKg", record.feedQuantityKg);
                  setCageValue("averageFishWeightKg", record.averageFishWeightKg);
                  setCageValue("mortalityPieces", record.mortalityPieces);
                  setCageValue("quantityHarvestedKg", record.quantityHarvestedKg);
                  setCageValue("numberHarvestedPieces", record.numberHarvestedPieces);
                  setCageValue("harvestDate", record.harvestDate ? record.harvestDate.slice(0, 10) : "");
                  setCageValue("extensionOfficerName", record.extensionOfficerName ?? "");
                  setCageValue("remarks", record.remarks ?? "");
                  setCageValue("month", record.month);
                  setCageValue("year", record.year);
                }}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={deleteCageRecord.isPending}
                onClick={() => {
                  setPendingAction({
                    title: "Delete cage production entry?",
                    message: `This will permanently delete ${record.cageCode}.`,
                    onConfirm: async () => {
                      try {
                        await deleteCageRecord.mutateAsync(record.id);
                        toast.success("Cage production entry deleted");
                      } catch (error) {
                        const message =
                          (error as AxiosError<{ error?: string }>).response?.data?.error ??
                          "Failed to delete cage production entry.";
                        toast.error(message);
                      }
                    }
                  });
                }}
              >
                Delete
              </Button>
            </div>
          ) : "-"
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm: cageSearchTerm || (cageSubCountyFilter !== "ALL" || cageYearFilter !== "ALL" ? "selected filters" : ""),
          isLoading: isLoadingCageProduction,
          loadingLabel: "Loading cage production records...",
          emptyLabel: "No cage production records found."
        })}
      />

      {pendingAction ? (
        <ConfirmDialog
          title={pendingAction.title}
          message={pendingAction.message}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            const action = pendingAction.onConfirm;
            setPendingAction(null);
            void action();
          }}
        />
      ) : null}
    </section>
  );
};

export default CaptureFisheriesPage;
