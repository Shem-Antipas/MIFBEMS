import { useMemo } from "react";
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
  catchKg: number;
  value: number;
  month: number;
  year: number;
  effortHours?: number;
};

const currentDate = new Date();

const captureFisheriesExportColumns = [
  { header: "Unique Number", value: "captureCode" },
  { header: "Extension Officer", value: "extensionOfficerName" },
  { header: "Officer Phone", value: "extensionOfficerPhone" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward of Extension", value: "ward" },
  { header: "Farmer Name", value: "fisherName" },
  { header: "Farmer Number", value: (record: CaptureFisheriesRecord) => record.farmerNumber ?? "" },
  { header: "Gender", value: "gender" },
  { header: "Age Bracket", value: "ageBracket" },
  { header: "Topics", value: (record: CaptureFisheriesRecord) => record.topics.join(", ") },
  { header: "GPS", value: (record: CaptureFisheriesRecord) => `${record.latitude ?? ""}, ${record.longitude ?? ""}` },
  { header: "Approval Status", value: "approvalStatus" },
  { header: "Month", value: (record: CaptureFisheriesRecord) => record.month ?? "" },
  { header: "Year", value: (record: CaptureFisheriesRecord) => record.year ?? "" },
  { header: "Recorded At", value: (record: CaptureFisheriesRecord) => new Date(record.createdAt) }
] satisfies Array<ExcelColumn<CaptureFisheriesRecord>>;

const CaptureFisheriesPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { data: records = [], isLoading } = useCaptureFisheries();

  const enforcedSubCounty =
    user?.role === "FISHERIES_OFFICER" && user.subCounty && MIGORI_SUBCOUNTIES.includes(user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      ? (user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      : undefined;

  const canRecord = user?.role === "FISHERIES_OFFICER" && Boolean(enforcedSubCounty);
  const canApprove = user?.role === "DIRECTOR" || user?.role === "ADMIN";

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["capture-fisheries"] });
    }
  });

  const approveRecord = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" }) =>
      captureFisheriesApi.updateApproval(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["capture-fisheries"] });
    }
  });

  const submitRecord = async (values: CaptureForm) => {
    try {
      await createRecord.mutateAsync({
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
        catchKg: Number(values.catchKg),
        value: Number(values.value),
        month: Number(values.month),
        year: Number(values.year),
        fishingDate: new Date(Number(values.year), Number(values.month) - 1, 1).toISOString(),
        effortHours: values.effortHours ? Number(values.effortHours) : undefined
      });

      toast.success("Extension registry entry saved");
      reset({
        extensionOfficerName: user?.name ?? "",
        extensionOfficerPhone: "",
        fisherName: "",
        farmerNumber: "",
        idNumber: "",
        phoneNumber: "",
        subCounty: (enforcedSubCounty ?? values.subCounty) as (typeof MIGORI_SUBCOUNTIES)[number],
        ward: WARDS_BY_SUBCOUNTY[(enforcedSubCounty ?? values.subCounty) as (typeof MIGORI_SUBCOUNTIES)[number]][0],
        gender: "MALE",
        ageBracket: "ADULT",
        topics: "",
        latitude: undefined,
        longitude: undefined,
        bmuName: "",
        landingSite: "",
        species: "Tilapia",
        catchKg: 0,
        value: 0,
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        effortHours: undefined
      });
    } catch (error) {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ??
        "Failed to save extension registry record.";
      toast.error(message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Extension Data Entry (Registry)</h1>
          <p className="text-sm text-muted-foreground">
            Track officer extension visits with gender, age bracket and admin/director approval workflow.
          </p>
        </div>
        <ExportButton filename="extension-registry" sheetName="Extension Registry" columns={captureFisheriesExportColumns} rows={records} />
      </div>

      {canRecord ? (
        <Card>
          <CardHeader>
            <CardTitle>Capture Extension Registry Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitRecord)}>
              <Input placeholder="Name of extension officer" {...register("extensionOfficerName", { required: true })} />
              <Input placeholder="Officer phone number" {...register("extensionOfficerPhone", { required: true })} />
              <Input value={enforcedSubCounty ?? ""} disabled aria-label="Sub County" />

              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
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

              <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("ward", { required: true })}>
                {availableWards.map((ward) => (
                  <option key={ward} value={ward}>
                    {ward}
                  </option>
                ))}
              </select>

              <Input placeholder="Farmer name" {...register("fisherName", { required: true })} />
              <Input placeholder="Farmer number" {...register("farmerNumber", { required: true })} />

              <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("gender", { required: true })}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>

              <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("ageBracket", { required: true })}>
                <option value="ADULT">Adult - Above 35</option>
                <option value="YOUTH">Youth - Below 35</option>
              </select>

              <Input placeholder="Topics (comma separated)" {...register("topics", { required: true })} />
              <Input type="number" step="0.000001" placeholder="GPS Latitude" {...register("latitude", { valueAsNumber: true })} />
              <Input type="number" step="0.000001" placeholder="GPS Longitude" {...register("longitude", { valueAsNumber: true })} />
              <Input placeholder="ID No." {...register("idNumber")} />
              <Input placeholder="Phone number" {...register("phoneNumber")} />
              <Input placeholder="BMU" {...register("bmuName")} />
              <Input placeholder="Landing site" {...register("landingSite")} />
              <Input placeholder="Species" {...register("species", { required: true })} />
              <Input type="number" step="0.1" placeholder="Quantity" {...register("catchKg", { valueAsNumber: true })} />
              <Input type="number" step="0.01" placeholder="Value" {...register("value", { valueAsNumber: true })} />
              <Input type="number" min="1" max="12" placeholder="Month" {...register("month", { valueAsNumber: true })} />
              <Input type="number" min="2000" max="2100" placeholder="Year" {...register("year", { valueAsNumber: true })} />
              <Input type="number" step="0.1" placeholder="Effort hours" {...register("effortHours", { valueAsNumber: true })} />

              <div className="flex justify-end md:col-span-3">
                <Button type="submit" disabled={createRecord.isPending}>
                  {createRecord.isPending ? "Saving..." : "Save Extension Entry"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Extension entry is available to fisheries officers with an assigned sub-county.
        </div>
      )}

      <DataTable
        headers={[
          "Unique No",
          "Officer",
          "Officer Phone",
          "Sub-County",
          "Ward",
          "Farmer Name",
          "Farmer No",
          "Gender",
          "Age Bracket",
          "Topics",
          "GPS",
          "Approval",
          "Actions"
        ]}
        rows={records.map((record) => [
          record.captureCode,
          record.extensionOfficerName,
          record.extensionOfficerPhone,
          record.subCounty,
          record.ward,
          record.fisherName,
          record.farmerNumber ?? "-",
          record.gender,
          record.ageBracket === "ADULT" ? "Adult (>35)" : "Youth (<35)",
          record.topics.join(", "),
          record.latitude != null && record.longitude != null
            ? `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`
            : "-",
          <StatusBadge key={`${record.id}-status`} status={record.approvalStatus} />,
          canApprove ? (
            <div key={`${record.id}-actions`} className="flex gap-2">
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
            </div>
          ) : (
            "-"
          )
        ])}
        emptyLabel={isLoading ? "Loading extension records..." : "No extension records found."}
      />
    </section>
  );
};

export default CaptureFisheriesPage;
