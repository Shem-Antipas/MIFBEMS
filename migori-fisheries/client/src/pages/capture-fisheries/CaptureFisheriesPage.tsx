import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { captureFisheriesApi, type CreateCaptureFisheriesPayload } from "@/api/captureFisheries";
import { useCaptureFisheries } from "@/hooks/useCaptureFisheries";
import { useAuthStore } from "@/store/authStore";
import { WARDS_BY_SUBCOUNTY } from "@/lib/locationData";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { CaptureFisheriesRecord } from "@/types";

type CaptureForm = {
  fisherName: string;
  idNumber: string;
  phoneNumber: string;
  ward: string;
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
  { header: "Name", value: "fisherName" },
  { header: "ID", value: (record: CaptureFisheriesRecord) => record.idNumber ?? "" },
  { header: "Phone", value: (record: CaptureFisheriesRecord) => record.phoneNumber ?? "" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: "ward" },
  { header: "BMU", value: (record: CaptureFisheriesRecord) => record.bmuName ?? "" },
  { header: "Species", value: "species" },
  { header: "Quantity", value: "catchKg" },
  { header: "Value", value: "value" },
  { header: "Month", value: (record: CaptureFisheriesRecord) => record.month ?? "" },
  { header: "Year", value: (record: CaptureFisheriesRecord) => record.year ?? "" },
  { header: "Recorded At", value: (record: CaptureFisheriesRecord) => new Date(record.createdAt) }
] satisfies Array<ExcelColumn<CaptureFisheriesRecord>>;

const CaptureFisheriesPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { data: records = [], isLoading } = useCaptureFisheries();
  const canRecord = user?.role === "FISHERIES_OFFICER" && user.subCounty === "Nyatike";

  const { register, handleSubmit, reset } = useForm<CaptureForm>({
    defaultValues: {
      fisherName: "",
      idNumber: "",
      phoneNumber: "",
      ward: WARDS_BY_SUBCOUNTY.Nyatike[0],
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

  const createRecord = useMutation({
    mutationFn: (payload: CreateCaptureFisheriesPayload) => captureFisheriesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["capture-fisheries"] });
    }
  });

  const submitRecord = async (values: CaptureForm) => {
    try {
      await createRecord.mutateAsync({
        fisherName: values.fisherName.trim(),
        idNumber: values.idNumber.trim() || undefined,
        phoneNumber: values.phoneNumber.trim() || undefined,
        ward: values.ward,
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
      toast.success("Capture fisheries record saved");
      reset({
        fisherName: "",
        idNumber: "",
        phoneNumber: "",
        ward: WARDS_BY_SUBCOUNTY.Nyatike[0],
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
        "Failed to save capture fisheries record.";
      toast.error(message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Capture Fisheries</h1>
          <p className="text-sm text-muted-foreground">
            Nyatike capture fisheries data collected from fishermen and BMUs.
          </p>
        </div>
        <ExportButton
          filename="capture-fisheries"
          sheetName="Capture Fisheries"
          columns={captureFisheriesExportColumns}
          rows={records}
        />
      </div>

      {canRecord ? (
        <Card>
          <CardHeader>
            <CardTitle>Record Capture Fisheries Data</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitRecord)}>
              <Input placeholder="Name" {...register("fisherName", { required: true })} />
              <Input placeholder="ID No." {...register("idNumber")} />
              <Input placeholder="Phone number" {...register("phoneNumber")} />
              <Input value="Nyatike" disabled aria-label="Sub County" />
              <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("ward", { required: true })}>
                {WARDS_BY_SUBCOUNTY.Nyatike.map((ward) => (
                  <option key={ward} value={ward}>
                    {ward}
                  </option>
                ))}
              </select>
              <Input placeholder="BMU" {...register("bmuName")} />
              <Input placeholder="Species" {...register("species", { required: true })} />
              <Input type="number" step="0.1" placeholder="Quantity" {...register("catchKg", { valueAsNumber: true })} />
              <Input type="number" step="0.01" placeholder="Value" {...register("value", { valueAsNumber: true })} />
              <Input type="number" min="1" max="12" placeholder="Month" {...register("month", { valueAsNumber: true })} />
              <Input type="number" min="2000" max="2100" placeholder="Year" {...register("year", { valueAsNumber: true })} />
              <Input type="number" step="0.1" placeholder="Effort hours" {...register("effortHours", { valueAsNumber: true })} />
              <Input placeholder="Landing site" {...register("landingSite")} />
              <div className="flex justify-end md:col-span-3">
                <Button type="submit" disabled={createRecord.isPending}>
                  {createRecord.isPending ? "Saving..." : "Save Capture Record"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Capture fisheries entry is available only to Nyatike extension officers.
        </div>
      )}

      <DataTable
        headers={["Unique No", "Name", "ID", "Phone", "Ward", "BMU", "Species", "Quantity", "Value", "Month", "Year"]}
        rows={records.map((record) => [
          record.captureCode,
          record.fisherName,
          record.idNumber ?? "-",
          record.phoneNumber ?? "-",
          record.ward,
          record.bmuName ?? "-",
          record.species,
          `${record.catchKg.toLocaleString()} kg`,
          `KES ${Number(record.value ?? 0).toLocaleString()}`,
          record.month ?? new Date(record.fishingDate).getMonth() + 1,
          record.year ?? new Date(record.fishingDate).getFullYear()
        ])}
        emptyLabel={isLoading ? "Loading capture fisheries records..." : "No capture fisheries records found."}
      />
    </section>
  );
};

export default CaptureFisheriesPage;
