import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { captureFisheriesApi, type CreateCaptureFisheriesPayload } from "@/api/captureFisheries";
import { useCaptureFisheries } from "@/hooks/useCaptureFisheries";
import { useAuthStore } from "@/store/authStore";

type CaptureForm = {
  fisherName: string;
  bmuName: string;
  landingSite: string;
  species: string;
  catchKg: number;
  effortHours?: number;
  fishingDate: string;
};

const CaptureFisheriesPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const { data: records = [], isLoading } = useCaptureFisheries();
  const canRecord = user?.role === "FISHERIES_OFFICER" && user.subCounty === "Nyatike";

  const { register, handleSubmit, reset } = useForm<CaptureForm>({
    defaultValues: {
      fisherName: "",
      bmuName: "",
      landingSite: "",
      species: "Tilapia",
      catchKg: 0,
      effortHours: undefined,
      fishingDate: new Date().toISOString().slice(0, 10)
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
        ...values,
        bmuName: values.bmuName.trim() || undefined,
        landingSite: values.landingSite.trim() || undefined,
        effortHours: values.effortHours ? Number(values.effortHours) : undefined,
        catchKg: Number(values.catchKg)
      });
      toast.success("Capture fisheries record saved");
      reset({
        fisherName: "",
        bmuName: "",
        landingSite: "",
        species: "Tilapia",
        catchKg: 0,
        effortHours: undefined,
        fishingDate: new Date().toISOString().slice(0, 10)
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
      <div>
        <h1 className="text-xl font-semibold">Capture Fisheries</h1>
        <p className="text-sm text-muted-foreground">
          Nyatike-only fisheries catch data collected from fishermen.
        </p>
      </div>

      {canRecord ? (
        <Card>
          <CardHeader>
            <CardTitle>Record Fisherman Catch</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitRecord)}>
              <Input placeholder="Fisherman name" {...register("fisherName", { required: true })} />
              <Input placeholder="BMU" {...register("bmuName")} />
              <Input placeholder="Landing site" {...register("landingSite")} />
              <Input placeholder="Species" {...register("species", { required: true })} />
              <Input type="number" step="0.1" placeholder="Catch (kg)" {...register("catchKg", { valueAsNumber: true })} />
              <Input type="number" step="0.1" placeholder="Effort hours" {...register("effortHours", { valueAsNumber: true })} />
              <Input type="date" {...register("fishingDate", { required: true })} />
              <div className="flex justify-end md:col-span-3">
                <Button type="submit" disabled={createRecord.isPending}>
                  {createRecord.isPending ? "Saving..." : "Save Catch Record"}
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
        headers={["Fisherman", "BMU", "Landing Site", "Species", "Catch", "Effort", "Date"]}
        rows={records.map((record) => [
          record.fisherName,
          record.bmuName ?? "-",
          record.landingSite ?? "-",
          record.species,
          `${record.catchKg.toLocaleString()} kg`,
          record.effortHours ? `${record.effortHours.toLocaleString()} hrs` : "-",
          new Date(record.fishingDate).toLocaleDateString()
        ])}
        emptyLabel={isLoading ? "Loading capture fisheries records..." : "No capture fisheries records found."}
      />
    </section>
  );
};

export default CaptureFisheriesPage;
