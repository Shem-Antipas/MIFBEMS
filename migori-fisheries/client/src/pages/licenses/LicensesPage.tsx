import { useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { Upload } from "lucide-react";
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
  { value: "FISHERMAN", label: "Fisherman's License" },
  { value: "FISH_TRADER", label: "Fish Trader License" },
  { value: "BOAT_OWNER", label: "Boat Owner License" },
  { value: "FISH_MOVEMENT_PERMIT", label: "Fish Movement Permit" },
  { value: "BOAT_LICENSE", label: "Boat License" },
  { value: "NEW_BOARD_REGISTRATION", label: "New Board Registration License" },
  { value: "ICE_PLANT", label: "Ice Plant License" },
  { value: "BOAT", label: "Boat Licensing" }
];

const formatLicenseType = (type: License["type"]): string =>
  type === "FISHERMAN"
    ? "Fisherman's License"
    : type
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

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

type ImportErrorRow = {
  row: string;
  issue: string;
};

const importErrorColumns = [
  { header: "Spreadsheet Row", value: "row" },
  { header: "Issue", value: "issue" }
] satisfies Array<ExcelColumn<ImportErrorRow>>;

const toImportErrorRows = (errors: string[]): ImportErrorRow[] =>
  errors.map((item) => {
    const match = item.match(/^Row\s+([^:]+):\s*(.*)$/i);
    return {
      row: match?.[1] ?? "-",
      issue: match?.[2] ?? item
    };
  });

const LicensesPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | License["status"]>("ALL");
  const [subCountyFilter, setSubCountyFilter] = useState("ALL");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const userRole = user?.role;
  const { data: licenses = [], isLoading } = useLicenses();
  const { data: farmers = [] } = useFarmers();
  const canRecordLicense = userRole === "FISHERIES_OFFICER";
  const canApproveLicense = userRole === "DIRECTOR" || userRole === "ADMIN";
  const canDeleteLicense = userRole === "DIRECTOR" || userRole === "ADMIN";
  const canImportLicenses = userRole === "DIRECTOR" || userRole === "ADMIN" || userRole === "FISHERIES_OFFICER";
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
  const importLicenses = useMutation({
    mutationFn: licensesApi.importSpreadsheet,
    onSuccess: (result) => {
      setImportFile(null);
      setImportErrors(result.errors);
      void queryClient.invalidateQueries({ queryKey: ["licenses"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });

      toast.success(
        `Import complete: ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} skipped.`
      );

      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} row${result.errors.length === 1 ? "" : "s"} need review.`);
      }
    }
  });
  const importErrorRows = useMemo(() => toImportErrorRows(importErrors), [importErrors]);

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
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("type")}
                >
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

      {canImportLicenses ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">Bulk Import Licenses</h2>
                <p className="text-sm text-muted-foreground">
                  Upload Excel or CSV files with Unique Number, Name, ID, Phone, Email, Sub-County, Ward, Beach Name,
                  Market, Receipt No, Amount Licensed, Licensed By, Type, Issued Date, Expiry Date, and Status.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex min-w-64 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{importFile ? importFile.name : "Choose .xlsx, .xls, or .csv file"}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="sr-only"
                    onChange={(event) => {
                      setImportErrors([]);
                      setImportFile(event.target.files?.[0] ?? null);
                    }}
                  />
                </label>
                <Button
                  type="button"
                  disabled={!importFile || importLicenses.isPending}
                  onClick={async () => {
                    if (!importFile) {
                      toast.error("Please choose an Excel or CSV file first.");
                      return;
                    }

                    try {
                      await importLicenses.mutateAsync(importFile);
                    } catch (mutationError) {
                      const message =
                        (mutationError as AxiosError<{ error?: string }>).response?.data?.error ??
                        "Failed to import licenses.";
                      toast.error(message);
                    }
                  }}
                >
                  {importLicenses.isPending ? "Importing..." : "Import Licenses"}
                </Button>
              </div>
            </div>

            {importErrors.length > 0 ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Rows that need attention</p>
                  <ExportButton
                    filename="license-import-row-issues"
                    sheetName="Import Issues"
                    columns={importErrorColumns}
                    rows={importErrorRows}
                    label="Download Issues"
                  />
                </div>
                <ul className="mt-2 max-h-32 list-disc space-y-1 overflow-y-auto pl-5">
                  {importErrors.slice(0, 12).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {importErrors.length > 12 ? (
                  <p className="mt-2 text-xs">Showing first 12 of {importErrors.length} row issues.</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        headers={[
          "Unique Number",
          "Name",
          "ID",
          "Phone",
          "Email",
          "Sub-County",
          "Ward",
          "Beach Name",
          "Market",
          "Receipt No",
          "Amount Licensed",
          "Licensed By",
          "Type",
          "Issued Date",
          "Expiry Date",
          "Status",
          "Actions"
        ]}
        rows={filteredLicenses.map((license) => [
          license.licenseNo,
          license.holderName ?? license.farmer?.name ?? "-",
          license.holderIdNumber ?? license.farmer?.idNumber ?? "-",
          license.holderPhoneNumber ?? license.farmer?.phoneNumber ?? "-",
          license.holderEmail ?? license.farmer?.email ?? "-",
          license.subCounty ?? license.farmer?.subCounty ?? "-",
          license.ward ?? license.farmer?.ward ?? "-",
          license.beachName ?? "-",
          license.market ?? "-",
          license.receiptNo ?? "-",
          Number(license.amountLicensed ?? 0).toLocaleString(),
          license.licensedByName ?? "-",
          formatLicenseType(license.type),
          new Date(license.issuedDate).toLocaleDateString(),
          new Date(license.expiryDate).toLocaleDateString(),
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
