import { useState } from "react";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import FarmerModal from "@/pages/farmers/FarmerModal";
import { useAuthStore } from "@/store/authStore";
import { useCreateFarmer, useFarmers } from "@/hooks/useFarmers";

const FarmersPage = () => {
  const [open, setOpen] = useState(false);
  const userRole = useAuthStore((state) => state.user?.role);

  const { data: farmers = [], isLoading } = useFarmers();
  const createFarmer = useCreateFarmer();

  const canCreate = userRole === "DIRECTOR" || userRole === "FISHERIES_OFFICER";

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

      <DataTable
        headers={["Name", "Sub-County", "Type", "Species", "Production", "Status"]}
        rows={farmers.map((farmer) => [
          farmer.name,
          farmer.subCounty,
          farmer.farmType,
          farmer.species.join(", "),
          `${farmer.productionKg.toLocaleString()} kg`,
          <StatusBadge key={farmer.id} status={farmer.status} />
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
