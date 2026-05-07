import { useMemo, useState, type ReactNode } from "react";
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
import { getSearchEmptyLabel } from "@/lib/search";
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

const FormField = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-sm font-medium text-foreground">{label}</span>
    {children}
  </label>
);

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
  const [searchTerm, setSearchTerm] = useState("");
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | License["status"]>("ALL");
  const [subCountyFilter, setSubCountyFilter] = useState("ALL");
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role;
  const { data: licenses = [], isLoading } = useLicenses();
  const { data: farmers = [] } = useFarmers();
  const canRecordLicense = userRole === "FISHERIES_OFFICER";
  const canApproveLicense = userRole === "DIRECTOR" || userRole === "ADMIN";
  const canDeleteLicense = userRole === "DIRECTOR" || userRole === "ADMIN";
  const enforcedSubCounty =
    userRole === "FISHERIES_OFFICER" && user?.subCounty && MIGORI_SUBCOUNTIES.includes(user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      ? user.subCounty
      : undefined;

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

  const deleteLicense = useMutation({
    mutationFn: licensesApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["licenses"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const filteredLicenses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return licenses.filter((license) => {
      const licenseSubCounty = license.subCounty ?? license.farmer?.subCounty ?? "";
      const matchesStatus = statusFilter === "ALL" || license.status === statusFilter;
      const matchesSubCounty = subCountyFilter === "ALL" || licenseSubCounty === subCountyFilter;
      const matchesSearch =
        !term ||
        [
          license.licenseNo,
          license.holderName ?? license.farmer?.name ?? "",
          license.holderIdNumber ?? license.farmer?.idNumber ?? "",
          license.holderPhoneNumber ?? license.farmer?.phoneNumber ?? "",
          licenseSubCounty,
          license.ward ?? license.farmer?.ward ?? "",
          license.receiptNo ?? "",
          license.type,
          license.holderEmail ?? license.farmer?.email ?? "",
          license.beachName ?? "",
          license.market ?? "",
          license.bmuName ?? "",
          license.licensedByName ?? "",
          String(license.amountLicensed ?? ""),
          license.status
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesSubCounty && matchesSearch;
    });
  }, [licenses, searchTerm, statusFilter, subCountyFilter]);

  const submitLicense = async (values: LicenseForm) => {
    try {
      const payload = {
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
      } satisfies CreateLicensePayload;

      if (editingLicenseId) {
        await licensesApi.update(editingLicenseId, payload);
        toast.success("License updated");
      } else {
        await createLicense.mutateAsync(payload);
        toast.success("License details recorded for Director approval");
      }

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
      setEditingLicenseId(null);
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
            Officers record license and receipt details. Director or Admin approval is required for validity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search licenses..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="VALID">Valid</option>
            <option value="EXPIRED">Expired</option>
            <option value="REVOKED">Revoked</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={subCountyFilter}
            onChange={(event) => setSubCountyFilter(event.target.value)}
            disabled={Boolean(enforcedSubCounty)}
          >
            <option value="ALL">All sub-counties</option>
            {(enforcedSubCounty ? [enforcedSubCounty] : MIGORI_SUBCOUNTIES).map((subCounty) => (
              <option key={subCounty} value={subCounty}>
                {subCounty}
              </option>
            ))}
          </select>
          <ExportButton filename="licenses" sheetName="Licenses" columns={licenseExportColumns} rows={filteredLicenses} />
        </div>
      </div>

      {canRecordLicense ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingLicenseId ? "Edit License Details" : "Record License Details"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitLicense)}>
              <FormField label="Unique License Number">
                <Input placeholder="e.g. MIG-LIC-0001" {...register("licenseNo", { required: true })} />
              </FormField>
              <FormField label="License Receipt Number">
                <Input placeholder="Receipt number from payment" {...register("receiptNo", { required: true })} />
              </FormField>
              <FormField label="Amount Licensed (KES)">
                <Input type="number" step="0.01" placeholder="0" {...register("amountLicensed", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Applicant Name">
                <Input placeholder="Name of license holder" {...register("holderName", { required: true })} />
              </FormField>
              <FormField label="Applicant ID Number">
                <Input placeholder="National ID or registration number" {...register("holderIdNumber", { required: true })} />
              </FormField>
              <FormField label="Applicant Phone Number">
                <Input placeholder="License holder phone number" {...register("holderPhoneNumber", { required: true })} />
              </FormField>
              <FormField label="Applicant Email">
                <Input type="email" placeholder="Optional email address" {...register("holderEmail")} />
              </FormField>
              <FormField label="Sub-County">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("subCounty", {
                    onChange: (event) => {
                      const nextSubCounty = event.target.value as keyof typeof WARDS_BY_SUBCOUNTY;
                      setValue("ward", WARDS_BY_SUBCOUNTY[nextSubCounty][0]);
                    }
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
              <FormField label="Beach Name">
                <Input placeholder="Landing beach, where applicable" {...register("beachName")} />
              </FormField>
              <FormField label="Market">
                <Input placeholder="Market for traders and depots" {...register("market")} />
              </FormField>
              <FormField label="BMU Name">
                <Input placeholder="Beach Management Unit name" {...register("bmuName")} />
              </FormField>
              <FormField label="Registry Holder">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("farmerId")}>
                  <option value="">Optional registry holder</option>
                  {availableFarmers.map((farmer) => (
                    <option key={farmer.id} value={farmer.id}>
                      {farmer.farmerCode} - {farmer.name} - {farmer.subCounty}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="License Type">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("type")}>
                  {licenseTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Issued Date">
                <Input type="date" {...register("issuedDate", { required: true })} />
              </FormField>
              <FormField label="Expiry Date">
                <Input type="date" {...register("expiryDate", { required: true })} />
              </FormField>
              <div className="flex justify-end md:col-span-3">
                {editingLicenseId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="mr-2"
                    onClick={() => {
                      setEditingLicenseId(null);
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
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={createLicense.isPending || updateLicense.isPending}>
                  {createLicense.isPending || updateLicense.isPending
                    ? "Saving..."
                    : editingLicenseId
                      ? "Update License"
                      : "Submit for Approval"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        headers={["Unique No", "Name", "ID", "Phone", "Sub-County", "Ward", "Type", "Receipt", "Amount", "Licensed By", "Status", "Actions"]}
        rows={filteredLicenses.map((license) => [
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
          canApproveLicense || canRecordLicense || canDeleteLicense ? (
            <div className="flex flex-wrap gap-2">
              {canRecordLicense && license.status === "PENDING" ? (
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingLicenseId(license.id);
                    setValue("licenseNo", license.licenseNo);
                    setValue("receiptNo", license.receiptNo ?? "");
                    setValue("bmuName", license.bmuName ?? "");
                    setValue("holderName", license.holderName ?? license.farmer?.name ?? "");
                    setValue("holderIdNumber", license.holderIdNumber ?? license.farmer?.idNumber ?? "");
                    setValue("holderPhoneNumber", license.holderPhoneNumber ?? license.farmer?.phoneNumber ?? "");
                    setValue("holderEmail", license.holderEmail ?? license.farmer?.email ?? "");
                    setValue("subCounty", license.subCounty ?? license.farmer?.subCounty ?? (user?.subCounty ?? "Suna East"));
                    setValue("ward", license.ward ?? license.farmer?.ward ?? availableWards[0]);
                    setValue("beachName", license.beachName ?? "");
                    setValue("market", license.market ?? "");
                    setValue("amountLicensed", Number(license.amountLicensed ?? 0));
                    setValue("farmerId", license.farmer?.id ?? "");
                    setValue("type", license.type);
                    setValue("issuedDate", license.issuedDate.slice(0, 10));
                    setValue("expiryDate", license.expiryDate.slice(0, 10));
                  }}
                >
                  Edit
                </Button>
              ) : null}
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
              {canDeleteLicense ? (
                <Button
                  size="sm"
                  type="button"
                  variant="destructive"
                  disabled={deleteLicense.isPending}
                  onClick={async () => {
                    if (!window.confirm(`Delete license ${license.licenseNo}?`)) {
                      return;
                    }
                    try {
                      await deleteLicense.mutateAsync(license.id);
                      toast.success("License deleted");
                    } catch (error) {
                      const message =
                        (error as AxiosError<{ error?: string }>).response?.data?.error ?? "Failed to delete license.";
                      toast.error(message);
                    }
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ) : (
            "-"
          )
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm: searchTerm || (statusFilter !== "ALL" || subCountyFilter !== "ALL" ? "selected filters" : ""),
          isLoading,
          loadingLabel: "Loading licenses...",
          emptyLabel: "No licenses found."
        })}
      />
    </section>
  );
};

export default LicensesPage;
