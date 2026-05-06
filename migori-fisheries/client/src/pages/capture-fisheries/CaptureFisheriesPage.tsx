import { useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { captureFisheriesApi, type CreateCaptureFisheriesPayload } from "@/api/captureFisheries";
import { useCaptureFisheries } from "@/hooks/useCaptureFisheries";
import { useAuthStore } from "@/store/authStore";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY } from "@/lib/locationData";
import { getSearchEmptyLabel } from "@/lib/search";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { CaptureFisheriesRecord } from "@/types";

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
  activeCages: number;
  inactiveCages: number;
  catchKg: number;
  value: number;
  month: number;
  year: number;
  effortHours?: number;
};

const currentDate = new Date();

const FormField = ({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) => (
  <label className={`block space-y-1 ${className}`}>
    <span className="text-sm font-medium text-foreground">{label}</span>
    {children}
  </label>
);

const captureFisheriesExportColumns = [
  { header: "Unique Number", value: "captureCode" },
  { header: "Name", value: "fisherName" },
  { header: "Phone", value: (record: CaptureFisheriesRecord) => record.phoneNumber ?? "" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: "ward" },
  { header: "Beach", value: (record: CaptureFisheriesRecord) => record.landingSite ?? "" },
  { header: "Active Cages", value: "activeCages" },
  { header: "Inactive Cages", value: "inactiveCages" },
  { header: "Quantity Harvested (Kg)", value: "catchKg" },
  { header: "Gender", value: "gender" },
  { header: "Age Bracket", value: "ageBracket" },
  { header: "Topics", value: (record: CaptureFisheriesRecord) => record.topics.join(", ") }
] satisfies Array<ExcelColumn<CaptureFisheriesRecord>>;

const CaptureFisheriesPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { data: records = [], isLoading } = useCaptureFisheries();
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const enforcedSubCounty =
    user?.role === "FISHERIES_OFFICER" && user.subCounty && MIGORI_SUBCOUNTIES.includes(user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      ? (user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      : undefined;

  const canRecord =
    (user?.role === "FISHERIES_OFFICER" && Boolean(enforcedSubCounty)) || user?.role === "DIRECTOR";
  const canApprove = user?.role === "DIRECTOR" || user?.role === "ADMIN";
  const canEditOrDelete = user?.role === "DIRECTOR" || user?.role === "ADMIN" || user?.role === "FISHERIES_OFFICER";

  const { register, handleSubmit, reset, control, setValue } = useForm<CaptureForm>({
    defaultValues: {
      extensionOfficerName: user?.name ?? "",
      extensionOfficerPhone: "",
      fisherName: "",
      farmerNumber: "",
      idNumber: "",
      phoneNumber: "",
      subCounty: (enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number],
      ward: WARDS_BY_SUBCOUNTY[(enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number]][0],
      gender: "MALE",
      ageBracket: "ADULT",
      topics: "",
      latitude: undefined,
      longitude: undefined,
      bmuName: "",
      landingSite: "",
      species: "Tilapia",
      activeCages: 0,
      inactiveCages: 0,
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
    defaultValue: (enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number]
  });
  const availableWards = useMemo(() => WARDS_BY_SUBCOUNTY[selectedSubCounty], [selectedSubCounty]);

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

  const filteredRecords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
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
        String(record.activeCages),
        String(record.inactiveCages),
        String(record.catchKg)
      ].some((value) => value.toLowerCase().includes(term))
    );
  }, [records, searchTerm]);

  const mapFormToPayload = (values: CaptureForm): CreateCaptureFisheriesPayload => ({
    extensionOfficerName: values.extensionOfficerName.trim(),
    extensionOfficerPhone: values.extensionOfficerPhone.trim(),
    fisherName: values.fisherName.trim(),
    farmerNumber: values.farmerNumber.trim() || undefined,
    idNumber: values.idNumber.trim() || undefined,
    phoneNumber: values.phoneNumber.trim() || undefined,
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
    activeCages: Number(values.activeCages),
    inactiveCages: Number(values.inactiveCages),
    catchKg: Number(values.catchKg),
    value: Number(values.value),
    month: Number(values.month),
    year: Number(values.year),
    fishingDate: new Date(Number(values.year), Number(values.month) - 1, 1).toISOString(),
    effortHours: values.effortHours ? Number(values.effortHours) : undefined
  });

  const resetForm = (subCounty: (typeof MIGORI_SUBCOUNTIES)[number]) => {
    reset({
      extensionOfficerName: user?.name ?? "",
      extensionOfficerPhone: "",
      fisherName: "",
      farmerNumber: "",
      idNumber: "",
      phoneNumber: "",
      subCounty,
      ward: WARDS_BY_SUBCOUNTY[subCounty][0],
      gender: "MALE",
      ageBracket: "ADULT",
      topics: "",
      latitude: undefined,
      longitude: undefined,
      bmuName: "",
      landingSite: "",
      species: "Tilapia",
      activeCages: 0,
      inactiveCages: 0,
      catchKg: 0,
      value: 0,
      month: currentDate.getMonth() + 1,
      year: currentDate.getFullYear(),
      effortHours: undefined
    });
    setEditingRecordId(null);
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
      resetForm((enforcedSubCounty ?? values.subCounty) as (typeof MIGORI_SUBCOUNTIES)[number]);
    } catch (error) {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ??
        "Failed to save capture entry.";
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
          <ExportButton filename="capture-fisheries" sheetName="Capture Fisheries" columns={captureFisheriesExportColumns} rows={filteredRecords} />
        </div>
      </div>

      {canRecord ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingRecordId ? "Edit Capture Fisheries Entry" : "Add Capture Fisheries Entry"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitRecord)}>
              <FormField label="Extension Officer Name">
                <Input placeholder="e.g. Dr. James Ochieng" {...register("extensionOfficerName", { required: true })} />
              </FormField>
              <FormField label="Extension Officer Phone">
                <Input placeholder="e.g. 0712345678" {...register("extensionOfficerPhone", { required: true })} />
              </FormField>

              <FormField label="Sub-County">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("subCounty", {
                    required: true,
                    onChange: (event) =>
                      setValue("ward", WARDS_BY_SUBCOUNTY[event.target.value as (typeof MIGORI_SUBCOUNTIES)[number]][0])
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
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("ward", { required: true })}>
                  {availableWards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Farmer or Fisher Name">
                <Input placeholder="Name of the farmer or fisher" {...register("fisherName", { required: true })} />
              </FormField>
              <FormField label="Farmer Number">
                <Input placeholder="Registry or unique farmer number" {...register("farmerNumber", { required: true })} />
              </FormField>
              <FormField label="Farmer Phone Number">
                <Input placeholder="Phone number for follow-up" {...register("phoneNumber")} />
              </FormField>
              <FormField label="Beach or Landing Site">
                <Input placeholder="Beach or landing site name" {...register("landingSite")} />
              </FormField>
              <FormField label="Number of Active Cages">
                <Input type="number" min="0" placeholder="0" {...register("activeCages", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Number of Inactive Cages">
                <Input type="number" min="0" placeholder="0" {...register("inactiveCages", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Quantity Harvested (Kg)">
                <Input type="number" step="0.1" placeholder="0" {...register("catchKg", { valueAsNumber: true })} />
              </FormField>

              <FormField label="Gender">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("gender", { required: true })}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </FormField>
              <FormField label="Age Bracket">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("ageBracket", { required: true })}>
                  <option value="ADULT">Adult - Above 35</option>
                  <option value="YOUTH">Youth - Below 35</option>
                </select>
              </FormField>
              <FormField label="Extension Topics">
                <Input placeholder="Separate topics with commas" {...register("topics", { required: true })} />
              </FormField>

              <div className="md:col-span-3 flex justify-end gap-2">
                {editingRecordId ? (
                  <Button type="button" variant="outline" onClick={() => resetForm((enforcedSubCounty ?? selectedSubCounty) as (typeof MIGORI_SUBCOUNTIES)[number])}>
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
          "Active Cages",
          "Inactive Cages",
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
          record.activeCages.toLocaleString(),
          record.inactiveCages.toLocaleString(),
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
                    setValue("ward", record.ward);
                    setValue("gender", record.gender);
                    setValue("ageBracket", record.ageBracket);
                    setValue("topics", record.topics.join(", "));
                    setValue("latitude", record.latitude ?? undefined);
                    setValue("longitude", record.longitude ?? undefined);
                    setValue("bmuName", record.bmuName ?? "");
                    setValue("landingSite", record.landingSite ?? "");
                    setValue("species", record.species);
                    setValue("activeCages", record.activeCages);
                    setValue("inactiveCages", record.inactiveCages);
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
                  onClick={async () => {
                    if (!window.confirm(`Delete capture entry ${record.captureCode}?`)) return;
                    try {
                      await deleteRecord.mutateAsync(record.id);
                      toast.success("Entry deleted");
                    } catch (error) {
                      const message =
                        (error as AxiosError<{ error?: string }>).response?.data?.error ??
                        "Failed to delete entry.";
                      toast.error(message);
                    }
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
                  onClick={async () => {
                    try {
                      await approveRecord.mutateAsync({ id: record.id, status: "APPROVED" });
                      toast.success("Entry approved");
                    } catch (error) {
                      const message =
                        (error as AxiosError<{ error?: string }>).response?.data?.error ??
                        "Failed to approve entry.";
                      toast.error(message);
                    }
                  }}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={approveRecord.isPending || record.approvalStatus === "REJECTED"}
                  onClick={async () => {
                    try {
                      await approveRecord.mutateAsync({ id: record.id, status: "REJECTED" });
                      toast.success("Entry rejected");
                    } catch (error) {
                      const message =
                        (error as AxiosError<{ error?: string }>).response?.data?.error ??
                        "Failed to reject entry.";
                      toast.error(message);
                    }
                  }}
                >
                  Reject
                </Button>
              </>
            ) : null}
          </div>
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm,
          isLoading,
          loadingLabel: "Loading capture fisheries records...",
          emptyLabel: "No capture fisheries records found."
        })}
      />
    </section>
  );
};

export default CaptureFisheriesPage;
