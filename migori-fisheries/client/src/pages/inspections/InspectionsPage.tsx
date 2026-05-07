import { useMemo, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { inspectionsApi, type CreateInspectionPayload } from "@/api/inspections";
import { useAuthStore } from "@/store/authStore";
import { getWardCoordinates, MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY } from "@/lib/locationData";
import { getSearchEmptyLabel } from "@/lib/search";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { ExtensionPhoto, Inspection } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ExtensionForm = {
  extensionOfficerName: string;
  extensionOfficerPhone: string;
  subCounty: (typeof MIGORI_SUBCOUNTIES)[number];
  ward: string;
  farmName: string;
  farmerNumber: string;
  farmerPhoneNumber: string;
  gender: "MALE" | "FEMALE";
  ageBracket: "YOUTH" | "ADULT";
  extensionTopics: string;
  feedback: string;
  challenges: string;
  latitude?: number;
  longitude?: number;
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

const MAX_EXTENSION_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const formatExtensionStatus = (result: Inspection["result"]): string => {
  if (result === "PASS") return "Completed";
  if (result === "FAIL") return "Incomplete";
  return "Pending";
};

const formatApprovalStatus = (status: Inspection["approvalStatus"]): string =>
  status.charAt(0) + status.slice(1).toLowerCase();

const FormField = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-sm font-medium text-foreground">{label}</span>
    {children}
  </label>
);

const fileToPhoto = (file: File): Promise<ExtensionPhoto> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type as ExtensionPhoto["type"],
        size: file.size,
        dataUrl: String(reader.result)
      });
    };
    reader.onerror = () => reject(new Error("Failed to read attached photo"));
    reader.readAsDataURL(file);
  });

const extensionExportColumns = [
  { header: "Unique Number", value: "entryCode" },
  { header: "Extension Officer", value: (item: Inspection) => item.extensionOfficerName ?? "" },
  { header: "Officer Phone", value: (item: Inspection) => item.extensionOfficerPhone ?? "" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: (item: Inspection) => item.ward ?? "" },
  { header: "Farmer Name", value: "farmName" },
  { header: "Farmer Number", value: (item: Inspection) => item.farmerNumber ?? item.farmerPhoneNumber ?? "" },
  { header: "Gender", value: "gender" },
  { header: "Age Bracket", value: "ageBracket" },
  { header: "Topics", value: (item: Inspection) => (item.extensionTopics ?? []).join(", ") },
  {
    header: "GPS",
    value: (item: Inspection) =>
      item.latitude != null && item.longitude != null ? `${item.latitude}, ${item.longitude}` : ""
  },
  { header: "Photos", value: (item: Inspection) => (item.photos ?? []).length },
  { header: "Approval", value: (item: Inspection) => formatApprovalStatus(item.approvalStatus) },
  { header: "Date", value: (item: Inspection) => new Date(item.date) }
] satisfies Array<ExcelColumn<Inspection>>;

const InspectionsPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingEntry, setViewingEntry] = useState<Inspection | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [photoAttachments, setPhotoAttachments] = useState<ExtensionPhoto[]>([]);

  const enforcedSubCounty =
    user?.role === "FISHERIES_OFFICER" && user.subCounty && MIGORI_SUBCOUNTIES.includes(user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      ? (user.subCounty as (typeof MIGORI_SUBCOUNTIES)[number])
      : undefined;

  const [statusFilter, setStatusFilter] = useState<"ALL" | Inspection["approvalStatus"]>("ALL");
  const [subCountyFilter, setSubCountyFilter] = useState<string>(enforcedSubCounty ?? "ALL");
  const [wardFilter, setWardFilter] = useState("ALL");

  const canWrite = user?.role === "FISHERIES_OFFICER";
  const canApprove = user?.role === "DIRECTOR" || user?.role === "ADMIN";
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

  const updateApproval = useMutation({
    mutationFn: ({ id, approvalStatus }: { id: string; approvalStatus: "APPROVED" | "REJECTED" }) =>
      inspectionsApi.updateApproval(id, approvalStatus),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inspections"] })
  });

  const deleteEntry = useMutation({
    mutationFn: inspectionsApi.remove,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inspections"] })
  });

  const { register, handleSubmit, reset, watch, setValue, control } = useForm<ExtensionForm>({
    defaultValues: {
      extensionOfficerName: user?.name ?? "",
      extensionOfficerPhone: "",
      subCounty: (enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number],
      ward: WARDS_BY_SUBCOUNTY[(enforcedSubCounty ?? "Suna East") as (typeof MIGORI_SUBCOUNTIES)[number]][0],
      farmName: "",
      farmerNumber: "",
      farmerPhoneNumber: "",
      gender: "MALE",
      ageBracket: "ADULT",
      extensionTopics: "",
      feedback: "",
      challenges: "",
      date: new Date().toISOString().slice(0, 10),
      result: "PENDING"
    }
  });

  const selectedSubCounty = watch("subCounty");
  const selectedWard = useWatch({ control, name: "ward" });
  const availableWards = WARDS_BY_SUBCOUNTY[selectedSubCounty];
  const wardLocation = getWardCoordinates(selectedSubCounty, selectedWard || availableWards[0]);
  const filterWardOptions = useMemo(() => {
    if (subCountyFilter !== "ALL" && MIGORI_SUBCOUNTIES.includes(subCountyFilter as (typeof MIGORI_SUBCOUNTIES)[number])) {
      return WARDS_BY_SUBCOUNTY[subCountyFilter as (typeof MIGORI_SUBCOUNTIES)[number]];
    }

    return Array.from(new Set(Object.values(WARDS_BY_SUBCOUNTY).flat())).sort((a, b) => a.localeCompare(b));
  }, [subCountyFilter]);

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesStatus = statusFilter === "ALL" || entry.approvalStatus === statusFilter;
      const matchesSubCounty = subCountyFilter === "ALL" || entry.subCounty === subCountyFilter;
      const matchesWard = wardFilter === "ALL" || entry.ward === wardFilter;
      const matchesSearch =
        !term ||
        [
          entry.entryCode,
          entry.extensionOfficerName ?? "",
          entry.extensionOfficerPhone ?? "",
          entry.farmName,
          entry.farmerNumber ?? "",
          entry.farmerPhoneNumber ?? "",
          entry.subCounty,
          entry.ward ?? "",
          entry.gender,
          entry.ageBracket,
          (entry.extensionTopics ?? []).join(", "),
          entry.feedback ?? "",
          entry.challenges ?? "",
          formatExtensionStatus(entry.result),
          formatApprovalStatus(entry.approvalStatus)
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesSubCounty && matchesWard && matchesSearch;
    });
  }, [entries, searchTerm, statusFilter, subCountyFilter, wardFilter]);

  const resetEntryForm = (subCounty: (typeof MIGORI_SUBCOUNTIES)[number] = enforcedSubCounty ?? selectedSubCounty) => {
    reset({
      extensionOfficerName: user?.name ?? "",
      extensionOfficerPhone: "",
      subCounty,
      ward: WARDS_BY_SUBCOUNTY[subCounty][0],
      farmName: "",
      farmerNumber: "",
      farmerPhoneNumber: "",
      gender: "MALE",
      ageBracket: "ADULT",
      extensionTopics: "",
      feedback: "",
      challenges: "",
      date: new Date().toISOString().slice(0, 10),
      result: "PENDING"
    });
    setPhotoAttachments([]);
    setEditingId(null);
  };

  const handlePhotoSelection = async (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length === 0) {
      setPhotoAttachments([]);
      return;
    }

    const invalidFile = selectedFiles.find((file) => !ALLOWED_PHOTO_TYPES.has(file.type));
    if (invalidFile) {
      toast.error("Attach PNG, JPG, JPEG, or WEBP images only.");
      return;
    }

    const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);
    if (totalSize > MAX_EXTENSION_PHOTO_BYTES) {
      toast.error("Attached photos must not exceed 5MB in total.");
      return;
    }

    try {
      setPhotoAttachments(await Promise.all(selectedFiles.map(fileToPhoto)));
    } catch {
      toast.error("Failed to read the selected photos.");
    }
  };

  const submitEntry = async (values: ExtensionForm) => {
    const latitude = Number.isFinite(values.latitude) ? Number(values.latitude) : wardLocation.lat;
    const longitude = Number.isFinite(values.longitude) ? Number(values.longitude) : wardLocation.lng;
    const payload: CreateInspectionPayload = {
      extensionOfficerName: values.extensionOfficerName.trim(),
      extensionOfficerPhone: values.extensionOfficerPhone.trim(),
      farmName: values.farmName.trim(),
      farmerNumber: values.farmerNumber.trim() || undefined,
      farmerPhoneNumber: values.farmerPhoneNumber.trim() || undefined,
      gender: values.gender,
      ageBracket: values.ageBracket,
      subCounty: values.subCounty,
      ward: values.ward,
      extensionTopics: values.extensionTopics.split(",").map((item) => item.trim()).filter(Boolean),
      feedback: values.feedback.trim() || undefined,
      challenges: values.challenges.trim() || undefined,
      latitude,
      longitude,
      photos: photoAttachments,
      date: values.date,
      result: values.result
    };

    try {
      if (editingId) {
        await updateEntry.mutateAsync({ id: editingId, payload });
        toast.success("Extension registry entry updated");
      } else {
        await createEntry.mutateAsync(payload);
        toast.success("Extension registry entry submitted for approval");
      }

      resetEntryForm(values.subCounty);
      setViewingEntry(null);
    } catch (error) {
      const response = (error as AxiosError<ApiErrorResponse>).response?.data;
      const firstIssue = response?.issues?.[0];
      const message =
        firstIssue ? `${firstIssue.path || "Field"}: ${firstIssue.message}` :
        response?.error ??
        "Failed to save extension registry entry.";
      toast.error(message);
    }
  };

  const changeApproval = async (entry: Inspection, approvalStatus: "APPROVED" | "REJECTED") => {
    try {
      await updateApproval.mutateAsync({ id: entry.id, approvalStatus });
      toast.success(`Extension entry ${approvalStatus.toLowerCase()}`);
      if (viewingEntry?.id === entry.id) {
        setViewingEntry({ ...entry, approvalStatus, approvedAt: new Date().toISOString(), result: approvalStatus === "APPROVED" ? "PASS" : "FAIL" });
      }
    } catch (error) {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ??
        "Failed to update extension approval.";
      toast.error(message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Extension Officer Registry</h1>
          <p className="text-sm text-muted-foreground">
            Officer field entries with demographics, GPS, attached photos, and Director/Admin approval.
          </p>
        </div>
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
            <option value="ALL">All approvals</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
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
          <ExportButton filename="extension-officer-registry" sheetName="Extension Registry" columns={extensionExportColumns} rows={filteredEntries} />
        </div>
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Registry Entry" : "Add Registry Entry"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleSubmit(submitEntry)}>
              <FormField label="Name of Extension Officer">
                <Input placeholder="Officer responsible" {...register("extensionOfficerName", { required: true })} />
              </FormField>
              <FormField label="Phone Number">
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
              <FormField label="Ward of Extension">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("ward", { required: true })}>
                  {availableWards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Farmer Name">
                <Input placeholder="Farmer served" {...register("farmName", { required: true })} />
              </FormField>
              <FormField label="Farmer Number">
                <Input placeholder="Farmer ID or phone" {...register("farmerNumber", { required: true })} />
              </FormField>
              <FormField label="Gender">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("gender", { required: true })}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </FormField>
              <FormField label="Age Bracket">
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("ageBracket", { required: true })}>
                  <option value="ADULT">Adult - Above 35</option>
                  <option value="YOUTH">Youth - Below 35</option>
                </select>
              </FormField>
              <FormField label="Farmer Phone">
                <Input placeholder="Optional farmer contact" {...register("farmerPhoneNumber")} />
              </FormField>
              <FormField label="Topics">
                <Input placeholder="Separate topics with commas" {...register("extensionTopics", { required: true })} />
              </FormField>
              <FormField label="Latitude">
                <Input type="number" step="0.00001" placeholder={`Default ${wardLocation.lat.toFixed(5)}`} {...register("latitude", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Longitude">
                <Input type="number" step="0.00001" placeholder={`Default ${wardLocation.lng.toFixed(5)}`} {...register("longitude", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Feedback">
                <Input placeholder="Feedback received" {...register("feedback")} />
              </FormField>
              <FormField label="Challenges">
                <Input placeholder="Challenges observed" {...register("challenges")} />
              </FormField>
              <FormField label="Service Date">
                <Input type="date" {...register("date", { required: true })} />
              </FormField>
              <div className="md:col-span-3">
                <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <ImagePlus className="h-4 w-4 text-primary" />
                  Photos
                </label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => void handlePhotoSelection(event.target.files)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Attach PNG, JPG, JPEG, or WEBP images. Total attachment size limit is 5MB.
                </p>
                {photoAttachments.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Attached: {photoAttachments.map((photo) => photo.name).join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-3 flex justify-end gap-2">
                {editingId ? (
                  <Button type="button" variant="outline" onClick={() => resetEntryForm()}>
                    Cancel Edit
                  </Button>
                ) : null}
                <Button type="submit" disabled={createEntry.isPending || updateEntry.isPending}>
                  {editingId ? "Update Entry" : "Submit for Approval"}
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
              <CardTitle>Extension Entry Details</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => setViewingEntry(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Unique Number</p>
              <p className="font-medium">{viewingEntry.entryCode}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Officer</p>
              <p className="font-medium">{viewingEntry.extensionOfficerName ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Approval</p>
              <StatusBadge status={formatApprovalStatus(viewingEntry.approvalStatus)} />
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
              <p className="text-muted-foreground">GPS</p>
              <p className="font-medium">
                {viewingEntry.latitude != null && viewingEntry.longitude != null
                  ? `${viewingEntry.latitude.toFixed(5)}, ${viewingEntry.longitude.toFixed(5)}`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Farmer</p>
              <p className="font-medium">{viewingEntry.farmName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Farmer Number</p>
              <p className="font-medium">{viewingEntry.farmerNumber ?? viewingEntry.farmerPhoneNumber ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Gender / Age</p>
              <p className="font-medium">{viewingEntry.gender} / {viewingEntry.ageBracket}</p>
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
            {(viewingEntry.photos ?? []).length > 0 ? (
              <div className="grid gap-2 md:col-span-3 sm:grid-cols-3">
                {(viewingEntry.photos ?? []).map((photo) => (
                  <img
                    key={`${viewingEntry.id}-${photo.name}`}
                    src={photo.dataUrl}
                    alt={photo.name}
                    className="h-32 w-full rounded-md border object-cover"
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <DataTable
        headers={[
          "Unique Number",
          "Officer",
          "Phone",
          "Sub-County",
          "Ward",
          "Farmer",
          "Farmer Number",
          "Gender",
          "Age",
          "Topics",
          "GPS",
          "Photos",
          "Approval",
          "Actions"
        ]}
        rows={filteredEntries.map((entry) => [
          entry.entryCode,
          entry.extensionOfficerName ?? "-",
          entry.extensionOfficerPhone ?? "-",
          entry.subCounty,
          entry.ward ?? "-",
          entry.farmName,
          entry.farmerNumber ?? entry.farmerPhoneNumber ?? "-",
          entry.gender === "MALE" ? "Male" : "Female",
          entry.ageBracket === "ADULT" ? "Adult" : "Youth",
          (entry.extensionTopics ?? []).join(", "),
          entry.latitude != null && entry.longitude != null ? `${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}` : "-",
          `${(entry.photos ?? []).length} file${(entry.photos ?? []).length === 1 ? "" : "s"}`,
          <StatusBadge key={`${entry.id}-approval`} status={formatApprovalStatus(entry.approvalStatus)} />,
          <div key={`${entry.id}-actions`} className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setViewingEntry(entry)}>
              View
            </Button>
            {canWrite && entry.approvalStatus === "PENDING" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(entry.id);
                  setPhotoAttachments(entry.photos ?? []);
                  setValue("extensionOfficerName", entry.extensionOfficerName ?? "");
                  setValue("extensionOfficerPhone", entry.extensionOfficerPhone ?? "");
                  setValue("subCounty", entry.subCounty as (typeof MIGORI_SUBCOUNTIES)[number]);
                  setValue("ward", entry.ward ?? WARDS_BY_SUBCOUNTY[entry.subCounty as (typeof MIGORI_SUBCOUNTIES)[number]][0]);
                  setValue("farmName", entry.farmName);
                  setValue("farmerNumber", entry.farmerNumber ?? entry.farmerPhoneNumber ?? "");
                  setValue("farmerPhoneNumber", entry.farmerPhoneNumber ?? "");
                  setValue("gender", entry.gender);
                  setValue("ageBracket", entry.ageBracket);
                  setValue("extensionTopics", (entry.extensionTopics ?? []).join(", "));
                  setValue("feedback", entry.feedback ?? "");
                  setValue("challenges", entry.challenges ?? "");
                  setValue("latitude", entry.latitude ?? undefined);
                  setValue("longitude", entry.longitude ?? undefined);
                  setValue("date", entry.date.slice(0, 10));
                  setValue("result", entry.result);
                }}
              >
                Edit
              </Button>
            ) : null}
            {canApprove && entry.approvalStatus === "PENDING" ? (
              <>
                <Button type="button" size="sm" onClick={() => void changeApproval(entry, "APPROVED")}>
                  Approve
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void changeApproval(entry, "REJECTED")}>
                  Reject
                </Button>
              </>
            ) : null}
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
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm: searchTerm || (statusFilter !== "ALL" || subCountyFilter !== "ALL" || wardFilter !== "ALL" ? "selected filters" : ""),
          isLoading,
          loadingLabel: "Loading extension registry...",
          emptyLabel: "No extension records found."
        })}
      />
    </section>
  );
};

export default InspectionsPage;
