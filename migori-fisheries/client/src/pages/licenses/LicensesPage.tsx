import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import { useLicenses } from "@/hooks/useLicenses";
import { useFarmers } from "@/hooks/useFarmers";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";
import { licensesApi, type CreateLicensePayload } from "@/api/licenses";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY } from "@/lib/locationData";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { License } from "@/types";

type LicenseForm = {
  licenseNo: string;
  receiptNo: string;
  bmuName: string;
  holderName: string;
  holderIdNumber: string;
  holderPhoneNumber: string;
  holderEmail: string;
  subCounty: string;
  ward: string;
  beachName: string;
  market: string;
  amountLicensed: number;
  farmerId: string;
  type: License["type"];
  issuedDate: string;
  expiryDate: string;
};

const licenseTypeOptions: Array<{ value: License["type"]; label: string }> = [
  { value: "FISH_DEPOT", label: "Fish Depot" },
  { value: "FISH_TRADER", label: "Fish Traders License" },
  { value: "BOAT_OWNER", label: "Boat Owner License" },
  { value: "FISHERMAN", label: "Fishermen License" },
  { value: "FISH_MOVEMENT_PERMIT", label: "Fish Movement Permit" },
  { value: "BOAT_LICENSE", label: "Boat Licensing" },
  { value: "NEW_BOARD_REGISTRATION", label: "New Board Registration License" },
  { value: "ICE_PLANT", label: "Ice Plant License" },
  { value: "BOAT", label: "Boat Licensing (Legacy)" }
];

const formatLicenseType = (type: License["type"]): string =>
  licenseTypeOptions.find((option) => option.value === type)?.label ?? type;

const licenseExportColumns = [
  { header: "Unique Number", value: "licenseNo" },
  { header: "Name", value: (license: License) => license.holderName ?? license.farmer?.name ?? "" },
  { header: "ID", value: (license: License) => license.holderIdNumber ?? license.farmer?.idNumber ?? "" },
  { header: "Phone", value: (license: License) => license.holderPhoneNumber ?? license.farmer?.phoneNumber ?? "" },
  { header: "Email", value: (license: License) => license.holderEmail ?? license.farmer?.email ?? "" },
  { header: "Sub-County", value: (license: License) => license.subCounty ?? license.farmer?.subCounty ?? "" },
  { header: "Ward", value: (license: License) => license.ward ?? license.farmer?.ward ?? "" },
  { header: "Beach Name", value: (license: License) => license.beachName ?? "" },
  { header: "Market", value: (license: License) => license.market ?? "" },
  { header: "Receipt No", value: (license: License) => license.receiptNo ?? "" },
  { header: "Amount Licensed", value: "amountLicensed" },
  { header: "Licensed By", value: (license: License) => license.licensedByName ?? "" },
  { header: "Type", value: (license: License) => formatLicenseType(license.type) },
  { header: "Issued Date", value: (license: License) => new Date(license.issuedDate) },
  { header: "Expiry Date", value: (license: License) => new Date(license.expiryDate) },
  { header: "Status", value: "status" }
] satisfies Array<ExcelColumn<License>>;

const LicensesPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role;
  const { data: licenses = [], isLoading } = useLicenses();
  const { data: farmers = [] } = useFarmers();
  const canRecordLicense = userRole === "FISHERIES_OFFICER";
  const canApproveLicense = userRole === "DIRECTOR";

  const availableFarmers = useMemo(
    () =>
      userRole === "FISHERIES_OFFICER"
        ? farmers.filter((farmer) => farmer.subCounty === user?.subCounty)
        : farmers,
    [farmers, user?.subCounty, userRole]
  );

  const { register, handleSubmit, reset, control, setValue } = useForm<LicenseForm>({
    defaultValues: {
      licenseNo: "",
      receiptNo: "",
      bmuName: "",
      holderName: "",
      holderIdNumber: "",
      holderPhoneNumber: "",
      holderEmail: "",
      subCounty: user?.subCounty ?? "Suna East",
      ward: WARDS_BY_SUBCOUNTY[(user?.subCounty as keyof typeof WARDS_BY_SUBCOUNTY) ?? "Suna East"]?.[0] ?? "God Jope",
      beachName: "",
      market: "",
      amountLicensed: 0,
      farmerId: "",
      type: "FISHERMAN",
      issuedDate: new Date().toISOString().slice(0, 10),
      expiryDate: ""
    }
  });

  const selectedSubCounty = useWatch({ control, name: "subCounty", defaultValue: user?.subCounty ?? "Suna East" });
  const availableWards = WARDS_BY_SUBCOUNTY[selectedSubCounty as keyof typeof WARDS_BY_SUBCOUNTY] ?? WARDS_BY_SUBCOUNTY["Suna East"];

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
        licenseNo: values.licenseNo.trim(),
        receiptNo: values.receiptNo.trim(),
        bmuName: values.bmuName.trim() || undefined,
        holderName: values.holderName.trim(),
        holderIdNumber: values.holderIdNumber.trim(),
        holderPhoneNumber: values.holderPhoneNumber.trim(),
        holderEmail: values.holderEmail.trim() || undefined,
        subCounty: values.subCounty,
        ward: values.ward,
        beachName: values.beachName.trim() || undefined,
        market: values.market.trim() || undefined,
        amountLicensed: Number(values.amountLicensed),
        farmerId: values.farmerId || undefined,
        type: values.type,
        issuedDate: values.issuedDate,
        expiryDate: values.expiryDate
      });
      toast.success("License details recorded for Director approval");
      reset({
        licenseNo: "",
        receiptNo: "",
        bmuName: "",
        holderName: "",
        holderIdNumber: "",
        holderPhoneNumber: "",
        holderEmail: "",
        subCounty: user?.subCounty ?? "Suna East",
        ward: WARDS_BY_SUBCOUNTY[(user?.subCounty as keyof typeof WARDS_BY_SUBCOUNTY) ?? "Suna East"]?.[0] ?? "God Jope",
        beachName: "",
        market: "",
        amountLicensed: 0,
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Licenses</h1>
          <p className="text-sm text-muted-foreground">
            Officers record license and receipt details. Director approval is required for validity.
          </p>
        </div>
        <ExportButton filename="licenses" sheetName="Licenses" columns={licenseExportColumns} rows={licenses} />
      </div>

      {canRecordLicense ? (
        <Card>
          <CardHeader>
            <CardTitle>Record License Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitLicense)}>
              <Input placeholder="Unique license number" {...register("licenseNo", { required: true })} />
              <Input placeholder="License receipt number" {...register("receiptNo", { required: true })} />
              <Input type="number" step="0.01" placeholder="Amount licensed" {...register("amountLicensed", { valueAsNumber: true })} />
              <Input placeholder="Name" {...register("holderName", { required: true })} />
              <Input placeholder="ID No." {...register("holderIdNumber", { required: true })} />
              <Input placeholder="Phone number" {...register("holderPhoneNumber", { required: true })} />
              <Input type="email" placeholder="Email (optional)" {...register("holderEmail")} />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register("subCounty", {
                  onChange: (event) => {
                    const nextSubCounty = event.target.value as keyof typeof WARDS_BY_SUBCOUNTY;
                    setValue("ward", WARDS_BY_SUBCOUNTY[nextSubCounty][0]);
                  }
                })}
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
              <Input placeholder="Beach name (Nyatike)" {...register("beachName")} />
              <Input placeholder="Market (traders and depots)" {...register("market")} />
              <Input placeholder="BMU" {...register("bmuName")} />
              <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("farmerId")}>
                <option value="">Optional registry holder</option>
                {availableFarmers.map((farmer) => (
                  <option key={farmer.id} value={farmer.id}>
                    {farmer.farmerCode} - {farmer.name} - {farmer.subCounty}
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
                  {createLicense.isPending ? "Recording..." : "Submit for Director Approval"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        headers={["Unique No", "Name", "ID", "Phone", "Sub-County", "Ward", "Type", "Receipt", "Amount", "Licensed By", "Status", "Actions"]}
        rows={licenses.map((license) => [
          license.licenseNo,
          license.holderName ?? license.farmer?.name ?? "-",
          license.holderIdNumber ?? license.farmer?.idNumber ?? "-",
          license.holderPhoneNumber ?? license.farmer?.phoneNumber ?? "-",
          license.subCounty ?? license.farmer?.subCounty ?? "-",
          license.ward ?? license.farmer?.ward ?? "-",
          formatLicenseType(license.type),
          license.receiptNo ?? "-",
          `KES ${Number(license.amountLicensed ?? 0).toLocaleString()}`,
          license.licensedByName ?? "-",
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
