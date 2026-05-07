import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FarmerModal from "@/pages/farmers/FarmerModal";
import { useAuthStore } from "@/store/authStore";
import { useCreateFarmer, useFarmers } from "@/hooks/useFarmers";
import { farmersApi } from "@/api/farmers";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { Farmer } from "@/types";
import { MIGORI_SUBCOUNTIES } from "@/lib/locationData";
import { getSearchEmptyLabel } from "@/lib/search";

const farmerExportColumns = [
  { header: "Farmer ID", value: "farmerCode" },
  { header: "Name", value: "name" },
  { header: "ID No.", value: (farmer: Farmer) => farmer.idNumber ?? "" },
  { header: "Phone Number", value: (farmer: Farmer) => farmer.phoneNumber ?? "" },
  { header: "Email", value: (farmer: Farmer) => farmer.email ?? "" },
  { header: "Gender", value: (farmer: Farmer) => farmer.gender ?? "" },
  { header: "Age Bracket", value: (farmer: Farmer) => farmer.ageBracket ?? "" },
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

const FarmersPage = () => {
  const [open, setOpen] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Farmer["status"]>("ALL");
  const [subCountyFilter, setSubCountyFilter] = useState("ALL");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
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
  const updateFarmer = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof farmersApi.update>[1] }) =>
      farmersApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["farmers"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });
  const deleteFarmer = useMutation({
    mutationFn: farmersApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["farmers"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });
  const importFarmers = useMutation({
    mutationFn: farmersApi.importSpreadsheet,
    onSuccess: (result) => {
      setImportFile(null);
      setImportErrors(result.errors);
      void queryClient.invalidateQueries({ queryKey: ["farmers"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });

      toast.success(
        `Import complete: ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} skipped.`
      );

      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} row${result.errors.length === 1 ? "" : "s"} need review.`);
      }
    }
  });

  const canCreate = userRole === "DIRECTOR" || userRole === "ADMIN" || userRole === "FISHERIES_OFFICER";
  const canDelete = userRole === "DIRECTOR" || userRole === "ADMIN";
  const canRecordLicense = userRole === "FISHERIES_OFFICER";
  const enforcedSubCounty =
    userRole === "FISHERIES_OFFICER" && userSubCounty && MIGORI_SUBCOUNTIES.includes(userSubCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      ? (userSubCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      : undefined;

  const errorMessage =
    (error as AxiosError<{ error?: string }> | null)?.response?.data?.error ??
    (error as Error | null)?.message ??
    "Failed to load farmers.";
  const importErrorRows = useMemo(() => toImportErrorRows(importErrors), [importErrors]);

  const filteredFarmers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return farmers.filter((farmer) => {
      const matchesStatus = statusFilter === "ALL" || farmer.status === statusFilter;
      const matchesSubCounty = subCountyFilter === "ALL" || farmer.subCounty === subCountyFilter;
      const matchesSearch =
        !term ||
        [
          farmer.farmerCode,
          farmer.name,
          farmer.idNumber ?? "",
          farmer.phoneNumber ?? "",
          farmer.email ?? "",
          farmer.subCounty,
          farmer.ward,
          farmer.farmType,
          farmer.species.join(", "),
          farmer.productionKg.toString(),
          farmer.numberOfPonds.toString(),
          farmer.status
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesSubCounty && matchesSearch;
    });
  }, [farmers, searchTerm, statusFilter, subCountyFilter]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Farmers Registry</h1>
          <p className="text-sm text-muted-foreground">Manage fish farmer records by sub-county.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search farmers..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PARTIALLY_ACTIVE">Partially active</option>
            <option value="SUSPENDED">Suspended</option>
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
          <ExportButton
            filename="farmers-registry"
            sheetName="Farmers"
            columns={farmerExportColumns}
            rows={filteredFarmers}
          />
          {canCreate ? (
            <Button
              type="button"
              onClick={() => {
                setEditingFarmer(null);
                setOpen(true);
              }}
            >
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

      {canCreate ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">Bulk Import Farmers</h2>
              <p className="text-sm text-muted-foreground">
                Upload Excel or CSV files with Farmer ID, Name, ID No., Phone, Email, Gender, Age Bracket, Sub-County, Ward,
                Production Unit, Species, Production (Kg), unit counts, Status, Latitude, Longitude, and Created At.
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
                disabled={!importFile || importFarmers.isPending}
                onClick={async () => {
                  if (!importFile) {
                    toast.error("Please choose an Excel or CSV file first.");
                    return;
                  }

                  try {
                    await importFarmers.mutateAsync(importFile);
                  } catch (mutationError) {
                    const message =
                      (mutationError as AxiosError<{ error?: string }>).response?.data?.error ??
                      "Failed to import farmers.";
                    toast.error(message);
                  }
                }}
              >
                {importFarmers.isPending ? "Importing..." : "Import Farmers"}
              </Button>
            </div>
          </div>

          {importErrors.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">Rows that need attention</p>
                <ExportButton
                  filename="farmer-import-row-issues"
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
        </div>
      ) : null}

      <DataTable
        headers={[
          "Farmer ID",
          "Name",
          "ID No.",
          "Phone",
          "Email",
          "Gender",
          "Age Bracket",
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
        rows={filteredFarmers.map((farmer) => [
          farmer.farmerCode,
          farmer.name,
          farmer.idNumber ?? "-",
          farmer.phoneNumber ?? "-",
          farmer.email ?? "-",
          farmer.gender ? (farmer.gender === "MALE" ? "Male" : "Female") : "-",
          farmer.ageBracket ? (farmer.ageBracket === "YOUTH" ? "Youth" : "Adult") : "-",
          farmer.subCounty,
          farmer.ward,
          farmer.farmType,
          farmer.species.join(", "),
          `${farmer.productionKg.toLocaleString()} kg`,
          farmer.numberOfPonds.toLocaleString(),
          farmer.activePonds.toLocaleString(),
          farmer.inactivePonds.toLocaleString(),
          <StatusBadge key={farmer.id} status={farmer.status} />,
          canCreate || canDelete ? (
            <div className="flex flex-wrap gap-2">
              {canCreate ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingFarmer(farmer);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </Button>
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
                </>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleteFarmer.isPending}
                  onClick={async () => {
                    if (!window.confirm(`Delete farmer ${farmer.name}?`)) {
                      return;
                    }

                    try {
                      await deleteFarmer.mutateAsync(farmer.id);
                      toast.success("Farmer deleted");
                    } catch (mutationError) {
                      const message =
                        (mutationError as AxiosError<{ error?: string }>).response?.data?.error ??
                        "Failed to delete farmer.";
                      toast.error(message);
                    }
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          ) : "-"
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm: searchTerm || (statusFilter !== "ALL" || subCountyFilter !== "ALL" ? "selected filters" : ""),
          isLoading,
          loadingLabel: "Loading farmers...",
          emptyLabel: "No farmers found."
        })}
        pageSize={25}
      />

      <FarmerModal
        key={editingFarmer?.id ?? "new-farmer"}
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingFarmer(null);
        }}
        isSubmitting={createFarmer.isPending || updateFarmer.isPending}
        canRecordLicense={canRecordLicense}
        enforcedSubCounty={enforcedSubCounty}
        initialFarmer={editingFarmer}
        onSubmit={async (payload) => {
          try {
            if (editingFarmer) {
              await updateFarmer.mutateAsync({ id: editingFarmer.id, payload });
              toast.success("Farmer updated successfully");
            } else {
              await createFarmer.mutateAsync(payload);
              toast.success("Farmer created successfully");
            }
            setOpen(false);
            setEditingFarmer(null);
          } catch (mutationError) {
            const message =
              (mutationError as AxiosError<{ error?: string }>).response?.data?.error ??
              (editingFarmer ? "Failed to update farmer." : "Failed to create farmer.");
            toast.error(message);
          }
        }}
      />
    </section>
  );
};

export default FarmersPage;
