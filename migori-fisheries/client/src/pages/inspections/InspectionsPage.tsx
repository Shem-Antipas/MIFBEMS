import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { inspectionsApi, type CreateInspectionPayload } from "@/api/inspections";
import { useAuthStore } from "@/store/authStore";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY } from "@/lib/locationData";
import { getSearchEmptyLabel } from "@/lib/search";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { Inspection } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ExtensionForm = {
  extensionOfficerName: string;
  extensionOfficerPhone: string;
  subCounty: (typeof MIGORI_SUBCOUNTIES)[number];
  ward: string;
  farmName: string;
  farmerPhoneNumber: string;
  extensionTopics: string;
  feedback: string;
  challenges: string;
  date: string;
  result: "PENDING" | "PASS" | "FAIL";
};

type ValidationIssue = {
  path: string;
  message: string;
};

type ApiErrorResponse = {
  error?: string;
  issues?: ValidationIssue[];
};

const formatExtensionStatus = (result: Inspection["result"]): string => {
  if (result === "PASS") return "Completed";
  if (result === "FAIL") return "Incomplete";
  return "Pending";
};

const FormField = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-sm font-medium text-foreground">{label}</span>
    {children}
  </label>
);

const extensionExportColumns = [
  { header: "Extension Officer", value: (item: Inspection) => item.extensionOfficerName ?? "" },
  { header: "Phone Number", value: (item: Inspection) => item.extensionOfficerPhone ?? "" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: (item: Inspection) => item.ward ?? "" },
  { header: "Farmer Name", value: "farmName" },
  { header: "Farmer Phone", value: (item: Inspection) => item.farmerPhoneNumber ?? "" },
  { header: "Extension Topics", value: (item: Inspection) => (item.extensionTopics ?? []).join(", ") },
  { header: "Feedback", value: (item: Inspection) => item.feedback ?? "" },
  { header: "Challenges", value: (item: Inspection) => item.challenges ?? "" },
  { header: "Date", value: (item: Inspection) => new Date(item.date) }
] satisfies Array<ExcelColumn<Inspection>>;

const InspectionsPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingEntry, setViewingEntry] = useState<Inspection | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const enforcedSubCounty =
    user?.role === "FISHERIES_OFFICER" && user.subCounty && MIGORI_SUBCOUNTIES.includes(user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      ? (user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      : undefined;

  const [statusFilter, setStatusFilter] = useState<"ALL" | Inspection["result"]>("ALL");
  const [subCountyFilter, setSubCountyFilter] = useState<string>(enforcedSubCounty ?? "ALL");
  const [wardFilter, setWardFilter] = useState("ALL");

  const canWrite = user?.role === "DIRECTOR" || user?.role === "ADMIN" || user?.role === "FISHERIES_OFFICER";
  const canDelete = user?.role === "DIRECTOR" || user?.role === "ADMIN";

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: inspectionsApi.list
  });

  const createEntry = useMutation({
    mutationFn: inspectionsApi.create,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inspections"] })
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateInspectionPayload> }) =>
      inspectionsApi.update(id, payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inspections"] })
  });

  const deleteEntry = useMutation({
    mutationFn: inspectionsApi.remove,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inspections"] })
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<ExtensionForm>({
    defaultValues: {
      extensionOfficerName: user?.name ?? "",
      extensionOfficerPhone: "",
      subCounty: (enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number],
      ward: WARDS_BY_SUBCOUNTY[(enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number]][0],
      farmName: "",
      farmerPhoneNumber: "",
      extensionTopics: "",
      feedback: "",
      challenges: "",
      date: new Date().toISOString().slice(0, 10),
      result: "PASS"
    }
  });

  const selectedSubCounty = watch("subCounty");
  const availableWards = WARDS_BY_SUBCOUNTY[selectedSubCounty];
  const filterWardOptions = useMemo(() => {
    if (subCountyFilter !== "ALL" && MIGORI_SUBCOUNTIES.includes(subCountyFilter as (typeof MIGORI_SUBCOUNTIES)[number])) {
      return WARDS_BY_SUBCOUNTY[subCountyFilter as (typeof MIGORI_SUBCOUNTIES)[number]];
    }

    return Array.from(new Set(Object.values(WARDS_BY_SUBCOUNTY).flat())).sort((a, b) => a.localeCompare(b));
  }, [subCountyFilter]);

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesStatus = statusFilter === "ALL" || entry.result === statusFilter;
      const matchesSubCounty = subCountyFilter === "ALL" || entry.subCounty === subCountyFilter;
      const matchesWard = wardFilter === "ALL" || entry.ward === wardFilter;
      const matchesSearch =
        !term ||
        [
          entry.extensionOfficerName ?? "",
          entry.extensionOfficerPhone ?? "",
          entry.farmName,
          entry.subCounty,
          entry.ward ?? "",
          entry.farmerPhoneNumber ?? "",
          (entry.extensionTopics ?? []).join(", "),
          entry.feedback ?? "",
          entry.challenges ?? "",
          formatExtensionStatus(entry.result)
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesSubCounty && matchesWard && matchesSearch;
    });
  }, [entries, searchTerm, statusFilter, subCountyFilter, wardFilter]);

  const submitEntry = async (values: ExtensionForm) => {
    const payload: CreateInspectionPayload = {
      extensionOfficerName: values.extensionOfficerName.trim(),
      extensionOfficerPhone: values.extensionOfficerPhone.trim(),
      farmName: values.farmName.trim(),
      farmerPhoneNumber: values.farmerPhoneNumber.trim() || undefined,
      subCounty: values.subCounty,
      ward: values.ward,
      extensionTopics: values.extensionTopics.split(",").map((item) => item.trim()).filter(Boolean),
      feedback: values.feedback.trim() || undefined,
      challenges: values.challenges.trim() || undefined,
      date: values.date,
      result: values.result
    };

    try {
      if (editingId) {
        await updateEntry.mutateAsync({ id: editingId, payload });
        toast.success("Extension service entry updated");
      } else {
        await createEntry.mutateAsync(payload);
        toast.success("Extension service entry saved");
      }

      reset({
        extensionOfficerName: user?.name ?? "",
        extensionOfficerPhone: "",
        subCounty: (enforcedSubCounty ?? values.subCounty) as (typeof MIGORI_SUBCOUNTIES)[number],
        ward: WARDS_BY_SUBCOUNTY[(enforcedSubCounty ?? values.subCounty) as (typeof MIGORI_SUBCOUNTIES)[number]][0],
        farmName: "",
        farmerPhoneNumber: "",
        extensionTopics: "",
        feedback: "",
        challenges: "",
        date: new Date().toISOString().slice(0, 10),
        result: "PASS"
      });
      setEditingId(null);
      setViewingEntry(null);
    } catch (error) {
      const response = (error as AxiosError<ApiErrorResponse>).response?.data;
      const firstIssue = response?.issues?.[0];
      const message =
        firstIssue ? `${firstIssue.path || "Field"}: ${firstIssue.message}` :
        response?.error ??
        "Failed to save extension service entry.";
      toast.error(message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Extension Services</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search extension entries..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="ALL">All statuses</option>
            <option value="PASS">Completed</option>
            <option value="FAIL">Incomplete</option>
            <option value="PENDING">Pending</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={subCountyFilter}
            onChange={(event) => {
              setSubCountyFilter(event.target.value);
              setWardFilter("ALL");
            }}
            disabled={Boolean(enforcedSubCounty)}
          >
            <option value="ALL">All sub-counties</option>
            {(enforcedSubCounty ? [enforcedSubCounty] : MIGORI_SUBCOUNTIES).map((subCounty) => (
              <option key={subCounty} value={subCounty}>
                {subCounty}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={wardFilter}
            onChange={(event) => setWardFilter(event.target.value)}
          >
            <option value="ALL">All wards</option>
            {filterWardOptions.map((ward) => (
              <option key={ward} value={ward}>
                {ward}
              </option>
            ))}
          </select>
          <ExportButton filename="extension-services" sheetName="Extension Services" columns={extensionExportColumns} rows={filteredEntries} />
        </div>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Extension Entry" : "Add Extension Entry"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitEntry)}>
              <FormField label="Extension Officer Name">
                <Input placeholder="Officer responsible for the visit" {...register("extensionOfficerName", { required: true })} />
              </FormField>
              <FormField label="Extension Officer Phone">
                <Input placeholder="Officer phone number" {...register("extensionOfficerPhone", { required: true })} />
              </FormField>
              <FormField label="Sub-County">
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("subCounty", {
                    onChange: (event) =>
                      setValue("ward", WARDS_BY_SUBCOUNTY[event.target.value as (typeof MIGORI_SUBCOUNTIES)[number]][0])
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
              <FormField label="Farmer Name">
                <Input placeholder="Farmer served by the officer" {...register("farmName", { required: true })} />
              </FormField>
              <FormField label="Farmer Phone Number">
                <Input placeholder="Farmer contact phone" {...register("farmerPhoneNumber")} />
              </FormField>
              <FormField label="Extension Topics">
                <Input placeholder="Separate topics with commas" {...register("extensionTopics", { required: true })} />
              </FormField>
              <FormField label="Feedback">
                <Input placeholder="Feedback received from the farmer" {...register("feedback")} />
              </FormField>
              <FormField label="Challenges">
                <Input placeholder="Challenges observed or reported" {...register("challenges")} />
              </FormField>
              <FormField label="Service Date">
                <Input type="date" {...register("date", { required: true })} />
              </FormField>
              <FormField label="Extension Status">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("result", { required: true })}>
                  <option value="PASS">Completed</option>
                  <option value="FAIL">Incomplete</option>
                </select>
              </FormField>

              <div className="md:col-span-3 flex justify-end gap-2">
                {editingId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      reset({
                        extensionOfficerName: user?.name ?? "",
                        extensionOfficerPhone: "",
                        subCounty: (enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number],
                        ward: WARDS_BY_SUBCOUNTY[(enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number]][0],
                        farmName: "",
                        farmerPhoneNumber: "",
                        extensionTopics: "",
                        feedback: "",
                        challenges: "",
                        date: new Date().toISOString().slice(0, 10),
                        result: "PASS"
                      });
                    }}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
                <Button type="submit" disabled={createEntry.isPending || updateEntry.isPending}>
                  {editingId ? "Update Entry" : "Save Entry"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {viewingEntry ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Inspection Details</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => setViewingEntry(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Officer</p>
              <p className="font-medium">{viewingEntry.extensionOfficerName ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Officer Phone</p>
              <p className="font-medium">{viewingEntry.extensionOfficerPhone ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Extension Status</p>
              <StatusBadge status={formatExtensionStatus(viewingEntry.result)} />
            </div>
            <div>
              <p className="text-muted-foreground">Sub-County</p>
              <p className="font-medium">{viewingEntry.subCounty}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ward</p>
              <p className="font-medium">{viewingEntry.ward ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Service Date</p>
              <p className="font-medium">{new Date(viewingEntry.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Farmer</p>
              <p className="font-medium">{viewingEntry.farmName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Farmer Phone</p>
              <p className="font-medium">{viewingEntry.farmerPhoneNumber ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Topics</p>
              <p className="font-medium">{(viewingEntry.extensionTopics ?? []).join(", ") || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Feedback</p>
              <p className="font-medium">{viewingEntry.feedback ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Challenges</p>
              <p className="font-medium">{viewingEntry.challenges ?? "-"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        headers={["Officer", "Phone", "Sub-County", "Ward", "Farmer", "Farmer Phone", "Topics", "Feedback", "Challenges", "Extension Status", "Actions"]}
        rows={filteredEntries.map((entry) => [
          entry.extensionOfficerName ?? "-",
          entry.extensionOfficerPhone ?? "-",
          entry.subCounty,
          entry.ward ?? "-",
          entry.farmName,
          entry.farmerPhoneNumber ?? "-",
          (entry.extensionTopics ?? []).join(", "),
          entry.feedback ?? "-",
          entry.challenges ?? "-",
          <StatusBadge key={`${entry.id}-status`} status={formatExtensionStatus(entry.result)} />,
          canWrite ? (
            <div key={`${entry.id}-actions`} className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setViewingEntry(entry)}
              >
                View
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(entry.id);
                  setValue("extensionOfficerName", entry.extensionOfficerName ?? "");
                  setValue("extensionOfficerPhone", entry.extensionOfficerPhone ?? "");
                  setValue("subCounty", entry.subCounty as (typeof MIGORI_SUBCOUNTIES)[number]);
                  setValue("ward", entry.ward ?? WARDS_BY_SUBCOUNTY[entry.subCounty as (typeof MIGORI_SUBCOUNTIES)[number]][0]);
                  setValue("farmName", entry.farmName);
                  setValue("farmerPhoneNumber", entry.farmerPhoneNumber ?? "");
                  setValue("extensionTopics", (entry.extensionTopics ?? []).join(", "));
                  setValue("feedback", entry.feedback ?? "");
                  setValue("challenges", entry.challenges ?? "");
                  setValue("date", entry.date.slice(0, 10));
                  setValue("result", entry.result);
                }}
              >
                Edit
              </Button>
              {canDelete ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deleteEntry.isPending}
                  onClick={async () => {
                    if (!window.confirm("Delete this extension entry?")) return;
                    try {
                      await deleteEntry.mutateAsync(entry.id);
                      toast.success("Entry deleted");
                      if (viewingEntry?.id === entry.id) {
                        setViewingEntry(null);
                      }
                    } catch (error) {
                      const message =
                        (error as AxiosError<{ error?: string }>).response?.data?.error ??
                        "Failed to delete entry.";
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
          searchTerm: searchTerm || (statusFilter !== "ALL" || subCountyFilter !== "ALL" || wardFilter !== "ALL" ? "selected filters" : ""),
          isLoading,
          loadingLabel: "Loading extension records...",
          emptyLabel: "No extension records found."
        })}
      />
    </section>
  );
};

export default InspectionsPage;
