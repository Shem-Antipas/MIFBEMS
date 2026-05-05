import { useState } from "react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import FarmerModal from "@/pages/farmers/FarmerModal";
import { useAuthStore } from "@/store/authStore";
import { useCreateFarmer, useFarmers } from "@/hooks/useFarmers";
import { farmersApi } from "@/api/farmers";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { Farmer } from "@/types";
import { MIGORI_SUBCOUNTIES } from "@/lib/locationData";

const farmerExportColumns = [
  { header: "Farmer ID", value: "farmerCode" },
  { header: "Name", value: "name" },
  { header: "ID No.", value: (farmer: Farmer) => farmer.idNumber ?? "" },
  { header: "Phone Number", value: (farmer: Farmer) => farmer.phoneNumber ?? "" },
  { header: "Email", value: (farmer: Farmer) => farmer.email ?? "" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: "ward" },
  { header: "Production Unit", value: "farmType" },
  { header: "Species", value: (farmer: Farmer) => farmer.species.join(", ") },
  { header: "Production (Kg)", value: "productionKg" },
  { header: "Number of Production Units", value: "numberOfPonds" },
  { header: "Number Active", value: "activePonds" },
  { header: "Number Inactive", value: "inactivePonds" },
  { header: "Status", value: "status" },
  { header: "Latitude", value: (farmer: Farmer) => farmer.latitude ?? "" },
  { header: "Longitude", value: (farmer: Farmer) => farmer.longitude ?? "" },
  { header: "Created At", value: (farmer: Farmer) => new Date(farmer.createdAt) }
] satisfies Array<ExcelColumn<Farmer>>;

const FarmersPage = () => {
  const [open, setOpen] = useState(false);
  const userRole = useAuthStore((state) => state.user?.role);
  const userSubCounty = useAuthStore((state) => state.user?.subCounty ?? null);
  const queryClient = useQueryClient();

  const { data: farmers = [], isLoading, isError, error } = useFarmers();
  const createFarmer = useCreateFarmer();
  const updateFarmerStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Farmer["status"] }) =>
      farmersApi.update(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["farmers"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const canCreate = userRole === "DIRECTOR" || userRole === "ADMIN" || userRole === "FISHERIES_OFFICER";
  const canRecordLicense = userRole === "FISHERIES_OFFICER";
  const enforcedSubCounty =
    userRole === "FISHERIES_OFFICER" && userSubCounty && MIGORI_SUBCOUNTIES.includes(userSubCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      ? (userSubCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      : undefined;

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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ExportButton
            filename="farmers-registry"
            sheetName="Farmers"
            columns={farmerExportColumns}
            rows={farmers}
          />
          {canCreate ? (
            <Button type="button" onClick={() => setOpen(true)}>
              Add Farmer
            </Button>
          ) : null}
        </div>
      </div>

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <DataTable
        headers={[
          "Farmer ID",
          "Name",
          "ID No.",
          "Phone",
          "Email",
          "Sub-County",
          "Ward",
          "Production Unit",
          "Species",
          "Production",
          "Units",
          "Active",
          "Inactive",
          "Status",
          "Actions"
        ]}
        rows={farmers.map((farmer) => [
          farmer.farmerCode,
          farmer.name,
          farmer.idNumber ?? "-",
          farmer.phoneNumber ?? "-",
          farmer.email ?? "-",
          farmer.subCounty,
          farmer.ward,
          farmer.farmType,
          farmer.species.join(", "),
          `${farmer.productionKg.toLocaleString()} kg`,
          farmer.numberOfPonds.toLocaleString(),
          farmer.activePonds.toLocaleString(),
          farmer.inactivePonds.toLocaleString(),
          <StatusBadge key={farmer.id} status={farmer.status} />,
          canCreate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={updateFarmerStatus.isPending}
              onClick={async () => {
                const nextStatus = farmer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                try {
                  await updateFarmerStatus.mutateAsync({ id: farmer.id, status: nextStatus });
                  toast.success(`Farmer marked ${nextStatus.toLowerCase()} successfully`);
                } catch (mutationError) {
                  const message =
                    (mutationError as AxiosError<{ error?: string }>).response?.data?.error ??
                    "Failed to update farmer status.";
                  toast.error(message);
                }
              }}
            >
              {farmer.status === "ACTIVE" ? "Mark inactive" : "Mark active"}
            </Button>
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
        canRecordLicense={canRecordLicense}
        enforcedSubCounty={enforcedSubCounty}
        onSubmit={async (payload) => {
          try {
            await createFarmer.mutateAsync(payload);
            toast.success("Farmer created successfully");
            setOpen(false);
          } catch (mutationError) {
            const message =
              (mutationError as AxiosError<{ error?: string }>).response?.data?.error ??
              "Failed to create farmer.";
            toast.error(message);
          }
        }}
      />
    </section>
  );
};

export default FarmersPage;
