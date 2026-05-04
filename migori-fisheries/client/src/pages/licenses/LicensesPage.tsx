import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { useLicenses } from "@/hooks/useLicenses";
import { useFarmers } from "@/hooks/useFarmers";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { licensesApi, type CreateLicensePayload } from "@/api/licenses";
import type { License } from "@/types";

type LicenseForm = {
  licenseNo: string;
  receiptNo: string;
  bmuName: string;
  farmerId: string;
  type: License["type"];
  issuedDate: string;
  expiryDate: string;
};

const licenseTypeOptions: Array<{ value: License["type"]; label: string }> = [
  { value: "FISHERMAN", label: "Fishermen" },
  { value: "FISH_TRADER", label: "Fish Traders" },
  { value: "BOAT", label: "Boats" }
];

const formatLicenseType = (type: License["type"]): string =>
  licenseTypeOptions.find((option) => option.value === type)?.label ?? type;

const LicensesPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role;
  const { data: licenses = [], isLoading } = useLicenses();
  const { data: farmers = [] } = useFarmers();
  const canRecordLicense = userRole === "FISHERIES_OFFICER";
  const canApproveLicense = userRole === "DIRECTOR" || userRole === "ADMIN";

  const availableFarmers = useMemo(
    () =>
      userRole === "FISHERIES_OFFICER"
        ? farmers.filter((farmer) => farmer.subCounty === user?.subCounty)
        : farmers,
    [farmers, user?.subCounty, userRole]
  );

  const { register, handleSubmit, reset } = useForm<LicenseForm>({
    defaultValues: {
      licenseNo: "",
      receiptNo: "",
      bmuName: "",
      farmerId: "",
      type: "FISHERMAN",
      issuedDate: new Date().toISOString().slice(0, 10),
      expiryDate: ""
    }
  });

  const createLicense = useMutation({
    mutationFn: (payload: CreateLicensePayload) => licensesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["licenses"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const updateLicense = useMutation({
    mutationFn: ({ id, status }: { id: string; status: License["status"] }) => licensesApi.update(id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["licenses"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const submitLicense = async (values: LicenseForm) => {
    try {
      await createLicense.mutateAsync({
        ...values,
        bmuName: values.bmuName.trim() || undefined
      });
      toast.success("License details recorded for approval");
      reset({
        licenseNo: "",
        receiptNo: "",
        bmuName: "",
        farmerId: "",
        type: "FISHERMAN",
        issuedDate: new Date().toISOString().slice(0, 10),
        expiryDate: ""
      });
    } catch (error) {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ?? "Failed to record license.";
      toast.error(message);
    }
  };

  const changeLicenseStatus = async (id: string, status: License["status"]) => {
    try {
      await updateLicense.mutateAsync({ id, status });
      toast.success(`License ${status.toLowerCase()}`);
    } catch (error) {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ?? "Failed to update license.";
      toast.error(message);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Licenses</h1>
        <p className="text-sm text-muted-foreground">
          Extension officers record receipt and BMU details. Admin and Director handle approvals.
        </p>
      </div>

      {canRecordLicense ? (
        <Card>
          <CardHeader>
            <CardTitle>Record License Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitLicense)}>
              <Input placeholder="License number" {...register("licenseNo", { required: true })} />
              <Input placeholder="Receipt number" {...register("receiptNo", { required: true })} />
              <Input placeholder="BMU name" {...register("bmuName")} />
              <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("farmerId", { required: true })}>
                <option value="">Select fisherman/trader/boat owner</option>
                {availableFarmers.map((farmer) => (
                  <option key={farmer.id} value={farmer.id}>
                    {farmer.name} - {farmer.subCounty}
                  </option>
                ))}
              </select>
              <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("type")}>
                {licenseTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input type="date" {...register("issuedDate", { required: true })} />
              <Input type="date" {...register("expiryDate", { required: true })} />
              <div className="flex justify-end md:col-span-3">
                <Button type="submit" disabled={createLicense.isPending}>
                  {createLicense.isPending ? "Recording..." : "Submit for Approval"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        headers={["License No", "Receipt", "BMU", "Holder", "Type", "Issued", "Expiry", "Status", "Actions"]}
        rows={licenses.map((license) => [
          license.licenseNo,
          license.receiptNo ?? "-",
          license.bmuName ?? "-",
          license.farmer?.name ?? "-",
          formatLicenseType(license.type),
          new Date(license.issuedDate).toLocaleDateString(),
          new Date(license.expiryDate).toLocaleDateString(),
          <StatusBadge key={license.id} status={license.status} />,
          canApproveLicense ? (
            <div className="flex flex-wrap gap-2">
              {license.status === "PENDING" ? (
                <>
                  <Button size="sm" type="button" onClick={() => void changeLicenseStatus(license.id, "VALID")}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => void changeLicenseStatus(license.id, "REJECTED")}
                  >
                    Reject
                  </Button>
                </>
              ) : null}
              {license.status !== "REVOKED" ? (
                <Button
                  size="sm"
                  type="button"
                  variant="destructive"
                  disabled={updateLicense.isPending}
                  onClick={() => void changeLicenseStatus(license.id, "REVOKED")}
                >
                  Revoke
                </Button>
              ) : null}
            </div>
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
