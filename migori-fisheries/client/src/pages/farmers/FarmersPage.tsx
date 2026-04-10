import { useState } from "react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import FarmerModal from "@/pages/farmers/FarmerModal";
import { useAuthStore } from "@/store/authStore";
import { useCreateFarmer, useFarmers } from "@/hooks/useFarmers";
import { farmersApi } from "@/api/farmers";

const FarmersPage = () => {
  const [open, setOpen] = useState(false);
  const userRole = useAuthStore((state) => state.user?.role);
  const queryClient = useQueryClient();

  const { data: farmers = [], isLoading, isError, error } = useFarmers();
  const createFarmer = useCreateFarmer();
  const updateFarmerStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) =>
      farmersApi.update(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["farmers"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const canCreate = userRole === "DIRECTOR" || userRole === "FISHERIES_OFFICER";

  const errorMessage =
    (error as AxiosError<{ error?: string }> | null)?.response?.data?.error ??
    (error as Error | null)?.message ??
    "Failed to load farmers.";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Farmers Registry</h1>
          <p className="text-sm text-muted-foreground">Manage fish farmer records by sub-county.</p>
        </div>
        {canCreate ? (
          <button onClick={() => setOpen(true)} className="rounded-lg bg-primary px-3 py-2 text-sm text-white">
            Add Farmer
          </button>
        ) : null}
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <DataTable
        headers={["Name", "Sub-County", "Ward", "Type", "Species", "Production", "Status", "Actions"]}
        rows={farmers.map((farmer) => [
          farmer.name,
          farmer.subCounty,
          farmer.ward,
          farmer.farmType,
          farmer.species.join(", "),
          `${farmer.productionKg.toLocaleString()} kg`,
          <StatusBadge key={farmer.id} status={farmer.status} />,
          canCreate ? (
            <button
              className="rounded-md border px-2 py-1 text-xs"
              disabled={updateFarmerStatus.isPending}
              onClick={async () => {
                const nextStatus = farmer.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
                try {
                  await updateFarmerStatus.mutateAsync({ id: farmer.id, status: nextStatus });
                  toast.success(`Farmer ${nextStatus === "SUSPENDED" ? "suspended" : "reactivated"} successfully`);
                } catch (mutationError) {
                  const message =
                    (mutationError as AxiosError<{ error?: string }>).response?.data?.error ??
                    "Failed to update farmer status.";
                  toast.error(message);
                }
              }}
            >
              {farmer.status === "SUSPENDED" ? "Activate" : "Suspend"}
            </button>
          ) : (
            "-"
          )
        ])}
        emptyLabel={isLoading ? "Loading farmers..." : "No farmers found."}
      />

      <FarmerModal
        open={open}
        onClose={() => setOpen(false)}
        isSubmitting={createFarmer.isPending}
        onSubmit={async (payload) => {
          await createFarmer.mutateAsync(payload);
          toast.success("Farmer created successfully");
          setOpen(false);
        }}
      />
    </section>
  );
};

export default FarmersPage;
