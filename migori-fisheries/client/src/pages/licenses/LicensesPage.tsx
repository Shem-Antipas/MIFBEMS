import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { useLicenses } from "@/hooks/useLicenses";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { useAuthStore } from "@/store/authStore";
import { licensesApi } from "@/api/licenses";

const LicensesPage = () => {
  const queryClient = useQueryClient();
  const userRole = useAuthStore((state) => state.user?.role);
  const { data: licenses = [], isLoading } = useLicenses();
  const revokeLicense = useMutation({
    mutationFn: (id: string) => licensesApi.update(id, { status: "REVOKED" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["licenses"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Licenses</h1>
      <DataTable
        headers={["License No", "Farmer", "Type", "Issued", "Expiry", "Status", "Actions"]}
        rows={licenses.map((license) => [
          license.licenseNo,
          license.farmer?.name ?? "-",
          license.type,
          new Date(license.issuedDate).toLocaleDateString(),
          new Date(license.expiryDate).toLocaleDateString(),
          <StatusBadge key={license.id} status={license.status} />,
          userRole === "DIRECTOR" && license.status !== "REVOKED" ? (
            <button
              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700"
              disabled={revokeLicense.isPending}
              onClick={async () => {
                try {
                  await revokeLicense.mutateAsync(license.id);
                  toast.success("License revoked");
                } catch (error) {
                  const message =
                    (error as AxiosError<{ error?: string }>).response?.data?.error ??
                    "Failed to revoke license.";
                  toast.error(message);
                }
              }}
            >
              Revoke
            </button>
          ) : (
            "-"
          )
        ])}
        emptyLabel={isLoading ? "Loading licenses..." : "No licenses found."}
      />
    </section>
  );
};

export default LicensesPage;
