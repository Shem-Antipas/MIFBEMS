import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { AxiosError } from "axios";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { projectsApi, type CreateProjectPayload, type UpdateProjectPayload } from "@/api/projects";
import { useAuthStore } from "@/store/authStore";
import {
  getWardCoordinates,
  MIGORI_SUBCOUNTIES,
  SUBCOUNTY_COORDINATES,
  WARDS_BY_SUBCOUNTY,
  type MigoriSubCounty
} from "@/lib/locationData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExcelColumn } from "@/lib/exportToExcel";
import { getSearchEmptyLabel } from "@/lib/search";
import type { BlueEconomyProject } from "@/types";

type ProjectStatus = BlueEconomyProject["status"];
type ProjectCategory = BlueEconomyProject["category"];

const COUNTY_WIDE = "County Wide";
const ALL_WARDS = "All wards";
const DEFAULT_SUBCOUNTY: MigoriSubCounty = "Suna East";
const COUNTY_WIDE_COORDINATES = { lat: -1.0634, lng: 34.4199 };
const PROJECT_SUBCOUNTY_OPTIONS = [...MIGORI_SUBCOUNTIES, COUNTY_WIDE];

const isMigoriSubCounty = (value: string): value is MigoriSubCounty =>
  MIGORI_SUBCOUNTIES.includes(value as MigoriSubCounty);

const projectStatusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "STALLED", label: "Stalled" },
  { value: "PLANNED", label: "Planned" },
  { value: "ONGOING", label: "Ongoing" },
  { value: "CANCELLED", label: "Cancelled" }
];

const projectCategoryOptions: Array<{ value: ProjectCategory; label: string }> = [
  { value: "BLUE_ECONOMY", label: "Blue Economy" },
  { value: "LAKEFRONT_DEVELOPMENT", label: "Lakefront Development" },
  { value: "AQUACULTURE_DEVELOPMENT", label: "Aquaculture Development" }
];

type ProjectForm = {
  budgetLine: string;
  category: ProjectCategory;
  name: string;
  description: string;
  subCounty: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  budget: number;
  completionPercent: number;
  funder: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
};

const formatStatus = (status: ProjectStatus): string =>
  projectStatusOptions.find((option) => option.value === status)?.label ?? status;

const FormField = ({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) => (
  <label className={`block space-y-1 ${className}`}>
    <span className="text-sm font-medium text-foreground">{label}</span>
    {children}
  </label>
);

const AttachmentField = ({
  label,
  children,
  helper
}: {
  label: string;
  children: ReactNode;
  helper?: ReactNode;
}) => (
  <div>
    <label className="mb-1 flex items-center gap-2 text-sm font-medium">
      <Paperclip className="h-4 w-4 text-primary" aria-hidden="true" />
      {label}
    </label>
    <div className="relative">
      <Paperclip className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      {children}
    </div>
    {helper}
  </div>
);

const projectExportColumns = [
  { header: "Project Name/Title", value: "name" },
  { header: "Project Code (Budget Line)", value: (project: BlueEconomyProject) => project.budgetLine ?? "" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: "ward" },
  {
    header: "GPS",
    value: (project: BlueEconomyProject) =>
      project.latitude != null && project.longitude != null ? `${project.latitude}, ${project.longitude}` : ""
  },
  { header: "Project Start Date", value: (project: BlueEconomyProject) => new Date(project.startDate) },
  { header: "Approved Project Cost", value: "budget" },
  { header: "Project Status", value: (project: BlueEconomyProject) => formatStatus(project.status) },
  { header: "% Completion", value: (project: BlueEconomyProject) => project.completionPercent }
] satisfies Array<ExcelColumn<BlueEconomyProject>>;

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const userDefaultSubCounty =
    user?.subCounty && isMigoriSubCounty(user.subCounty) ? user.subCounty : DEFAULT_SUBCOUNTY;
  const enforcedProjectSubCounty = user?.role === "FISHERIES_OFFICER" ? userDefaultSubCounty : undefined;

  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProjectStatus>("ALL");
  const [subCountyFilter, setSubCountyFilter] = useState("ALL");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list
  });

  const { register, handleSubmit, reset, control, setValue } = useForm<ProjectForm>({
    defaultValues: {
      budgetLine: "",
      category: "BLUE_ECONOMY",
      name: "",
      description: "",
      subCounty: userDefaultSubCounty,
      ward: ALL_WARDS,
      budget: 0,
      completionPercent: 0,
      funder: "County Government of Migori",
      status: "PENDING",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: ""
    }
  });

  const selectedSubCounty = useWatch({ control, name: "subCounty", defaultValue: userDefaultSubCounty });
  const selectedWard = useWatch({ control, name: "ward", defaultValue: ALL_WARDS });

  const availableWards = useMemo(() => {
    if (selectedSubCounty === COUNTY_WIDE) {
      return [ALL_WARDS];
    }

    if (isMigoriSubCounty(selectedSubCounty)) {
      return [ALL_WARDS, ...WARDS_BY_SUBCOUNTY[selectedSubCounty]];
    }

    return [ALL_WARDS, ...WARDS_BY_SUBCOUNTY[DEFAULT_SUBCOUNTY]];
  }, [selectedSubCounty]);

  const wardLocation = useMemo(() => {
    if (selectedSubCounty === COUNTY_WIDE) {
      return COUNTY_WIDE_COORDINATES;
    }

    if (isMigoriSubCounty(selectedSubCounty)) {
      const subCountyCenter = SUBCOUNTY_COORDINATES[selectedSubCounty];
      if (availableWards.includes(selectedWard)) {
        return getWardCoordinates(selectedSubCounty, selectedWard);
      }
      return subCountyCenter;
    }

    return COUNTY_WIDE_COORDINATES;
  }, [availableWards, selectedSubCounty, selectedWard]);

  const canCreateProject = user?.role === "DIRECTOR" || user?.role === "ADMIN" || user?.role === "FISHERIES_OFFICER";
  const canEditProject = canCreateProject;
  const canUpdateProjectStatus = user?.role === "DIRECTOR" || user?.role === "ADMIN";
  const canDeleteProject = user?.role === "DIRECTOR" || user?.role === "ADMIN";

  const createProject = useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const importProjects = useMutation({
    mutationFn: (file: File) => projectsApi.importSpreadsheet(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const updateProject = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectPayload }) => projectsApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const [statusDrafts, setStatusDrafts] = useState<Record<string, ProjectStatus>>({});

  const resetProjectForm = () => {
    setEditingProjectId(null);
    setSelectedImageFiles([]);
    reset({
      budgetLine: "",
      category: "BLUE_ECONOMY",
      name: "",
      description: "",
      subCounty: userDefaultSubCounty,
      ward: ALL_WARDS,
      budget: 0,
      completionPercent: 0,
      funder: "County Government of Migori",
      status: "PENDING",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: ""
    });
  };

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesStatus = statusFilter === "ALL" || project.status === statusFilter;
      const matchesSubCounty = subCountyFilter === "ALL" || project.subCounty === subCountyFilter;
      const matchesSearch =
        !term ||
        [
          project.projectCode,
          project.name,
          project.budgetLine ?? "",
          project.category,
          project.description,
          project.subCounty,
          project.ward,
          project.status,
          project.funder,
          String(project.budget),
          String(project.completionPercent)
        ].some((value) => value.toLowerCase().includes(term));

      return matchesStatus && matchesSubCounty && matchesSearch;
    });
  }, [projects, searchTerm, statusFilter, subCountyFilter]);

  const rows = useMemo(
    () =>
      filteredProjects.map((project) => {
        const selectedStatus = statusDrafts[project.id] ?? project.status;
        const gps =
          project.latitude != null && project.longitude != null
            ? `${project.latitude.toFixed(5)}, ${project.longitude.toFixed(5)}`
            : "-";

        return [
          project.name,
          project.budgetLine ?? "-",
          project.subCounty,
          project.ward,
          gps,
          new Date(project.startDate).getFullYear().toString(),
          `KES ${project.budget.toLocaleString()}`,
          <StatusBadge key={`${project.id}-status`} status={formatStatus(project.status)} />,
          `${Math.round(project.completionPercent)}%`,
          canEditProject || canUpdateProjectStatus || canDeleteProject ? (
            <div className="flex items-center gap-2">
              {canEditProject ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingProjectId(project.id);
                    setSelectedImageFiles([]);
                    reset({
                      budgetLine: project.budgetLine ?? "",
                      category: project.category,
                      name: project.name,
                      description: project.description,
                      subCounty: project.subCounty,
                      ward: project.ward,
                      budget: project.budget,
                      completionPercent: project.completionPercent,
                      funder: project.funder,
                      status: project.status,
                      startDate: project.startDate.slice(0, 10),
                      endDate: project.endDate ? project.endDate.slice(0, 10) : ""
                    });
                  }}
                >
                  Edit
                </Button>
              ) : null}
              {canUpdateProjectStatus ? (
                <>
                  <select
                    className="rounded-md border px-2 py-1 text-xs"
                    value={selectedStatus}
                    onChange={(event) => {
                      setStatusDrafts((prev) => ({
                        ...prev,
                        [project.id]: event.target.value as ProjectStatus
                      }));
                    }}
                  >
                    {projectStatusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={updateProject.isPending || selectedStatus === project.status}
                    onClick={async () => {
                      try {
                        await updateProject.mutateAsync({
                          id: project.id,
                          payload: {
                            status: selectedStatus,
                            completionPercent: selectedStatus === "COMPLETED" ? 100 : undefined
                          }
                        });
                        toast.success("Project status updated");
                      } catch (error) {
                        const message =
                          (error as AxiosError<{ error?: string }>).response?.data?.error ??
                          "Failed to update project status.";
                        toast.error(message);
                      }
                    }}
                  >
                    Save
                  </Button>
                </>
              ) : null}
              {canDeleteProject ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleteProject.isPending}
                  onClick={async () => {
                    const confirmed = window.confirm(`Delete project "${project.name}"? This action cannot be undone.`);
                    if (!confirmed) {
                      return;
                    }

                    try {
                      await deleteProject.mutateAsync(project.id);
                      toast.success("Project deleted");
                    } catch (error) {
                      const message =
                        (error as AxiosError<{ error?: string }>).response?.data?.error ??
                        "Failed to delete project.";
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
        ];
      }),
    [filteredProjects, statusDrafts, canEditProject, canUpdateProjectStatus, canDeleteProject, reset, updateProject, deleteProject]
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Blue Economy Projects</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search projects..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="ALL">All statuses</option>
            {projectStatusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={subCountyFilter}
            onChange={(event) => setSubCountyFilter(event.target.value)}
            disabled={Boolean(enforcedProjectSubCounty)}
          >
            <option value="ALL">All sub-counties</option>
            {(enforcedProjectSubCounty ? [enforcedProjectSubCounty] : PROJECT_SUBCOUNTY_OPTIONS).map((subCounty) => (
              <option key={subCounty} value={subCounty}>
                {subCounty}
              </option>
            ))}
          </select>
          <ExportButton
            filename="blue-economy-projects"
            sheetName="Projects"
            columns={projectExportColumns}
            rows={filteredProjects}
          />
        </div>
      </div>

      {canCreateProject ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px]">
              <AttachmentField label="Bulk import projects (Excel/CSV)">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="pl-9"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setImportFile(file);
                  }}
                />
              </AttachmentField>
            </div>
            <Button
              type="button"
              disabled={!importFile || importProjects.isPending}
              onClick={async () => {
                if (!importFile) {
                  toast.error("Choose a CSV/Excel file to import.");
                  return;
                }

                try {
                  const result = await importProjects.mutateAsync(importFile);
                  if (result.errors.length > 0) {
                    toast.warning(`Imported ${result.createdCount}. Some rows were skipped.`);
                  } else {
                    toast.success(`Imported ${result.createdCount} projects successfully.`);
                  }
                  setImportFile(null);
                } catch (error) {
                  const message =
                    (error as AxiosError<{ error?: string }>).response?.data?.error ??
                    "Failed to import project file.";
                  toast.error(message);
                }
              }}
            >
              {importProjects.isPending ? "Importing..." : "Import File"}
            </Button>
          </div>
          {importFile ? <p className="mt-2 text-xs text-muted-foreground">Selected file: {importFile.name}</p> : null}
        </div>
      ) : null}

      {canCreateProject ? (
        <form
          className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"
          onSubmit={handleSubmit(async (values) => {
            try {
              let uploadedPhotos: string[] = [];
              if (selectedImageFiles.length > 0) {
                uploadedPhotos = await projectsApi.uploadImages(selectedImageFiles);
              }

              const projectPayload = {
                budgetLine: values.budgetLine.trim() || undefined,
                category: values.category,
                name: values.name,
                description: values.description,
                subCounty: values.subCounty,
                ward: values.ward,
                latitude: Number.isFinite(values.latitude) ? values.latitude : wardLocation.lat,
                longitude: Number.isFinite(values.longitude) ? values.longitude : wardLocation.lng,
                budget: Number(values.budget),
                completionPercent: Number(values.completionPercent),
                funder: values.funder,
                status: values.status,
                photos: uploadedPhotos,
                startDate: values.startDate,
                endDate: values.endDate || null
              } satisfies CreateProjectPayload;

              if (editingProjectId) {
                await updateProject.mutateAsync({
                  id: editingProjectId,
                  payload: {
                    ...projectPayload,
                    photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined
                  }
                });
                toast.success("Project updated successfully");
              } else {
                await createProject.mutateAsync(projectPayload);
                toast.success("Project added successfully");
              }
              resetProjectForm();
            } catch (error) {
              const message =
                (error as AxiosError<{ error?: string }>).response?.data?.error ??
                (editingProjectId ? "Failed to update project." : "Failed to add project.");
              toast.error(message);
            }
          })}
        >
          <FormField label="Project Name or Title">
            <Input placeholder="e.g. Procurement of fingerlings" {...register("name", { required: true })} />
          </FormField>
          <FormField label="Project Code or Budget Line">
            <Input placeholder="Budget line code, where available" {...register("budgetLine")} />
          </FormField>
          <FormField label="Approved Project Cost (KES)">
            <Input type="number" step="0.1" placeholder="0" {...register("budget", { valueAsNumber: true })} />
          </FormField>

          <FormField label="Project Category">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("category")}>
              {projectCategoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Sub-County">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register("subCounty", {
                onChange: (event) => {
                  const nextSubCounty = event.target.value;
                  if (nextSubCounty === COUNTY_WIDE) {
                    setValue("ward", ALL_WARDS);
                    return;
                  }

                  if (isMigoriSubCounty(nextSubCounty)) {
                    setValue("ward", ALL_WARDS);
                  }
                }
              })}
              disabled={Boolean(enforcedProjectSubCounty)}
            >
              {(enforcedProjectSubCounty ? [enforcedProjectSubCounty] : PROJECT_SUBCOUNTY_OPTIONS).map((subCounty) => (
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

          <FormField label="Project Start Date">
            <Input type="date" {...register("startDate", { required: true })} />
          </FormField>
          <FormField label="Completion Percentage">
            <Input type="number" min={0} max={100} step="1" placeholder="0 to 100" {...register("completionPercent", { valueAsNumber: true })} />
          </FormField>

          <FormField label="Project Status">
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("status")}>
              {projectStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Latitude">
            <Input type="number" step="0.00001" placeholder={`Default ${wardLocation.lat.toFixed(5)}`} {...register("latitude", { valueAsNumber: true })} />
          </FormField>
          <FormField label="Longitude">
            <Input type="number" step="0.00001" placeholder={`Default ${wardLocation.lng.toFixed(5)}`} {...register("longitude", { valueAsNumber: true })} />
          </FormField>
          <FormField label="Funder">
            <Input placeholder="Funding institution or source" {...register("funder", { required: true })} />
          </FormField>
          <FormField label="Project Description" className="md:col-span-3">
            <Input placeholder="Brief project description" {...register("description", { required: true })} />
          </FormField>

          <div className="md:col-span-3">
            <AttachmentField
              label="Project images (attach files)"
              helper={
                selectedImageFiles.length > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Attached: {selectedImageFiles.map((file) => file.name).join(", ")}
                  </p>
                ) : null
              }
            >
              <Input
                type="file"
                accept="image/*"
                multiple
                className="pl-9"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  setSelectedImageFiles(files);
                }}
              />
            </AttachmentField>
          </div>

          <FormField label="Project End Date">
            <Input type="date" {...register("endDate")} />
          </FormField>

          <div className="flex justify-end md:col-span-3">
            {editingProjectId ? (
              <Button type="button" variant="outline" className="mr-2" onClick={resetProjectForm}>
                Cancel Edit
              </Button>
            ) : null}
            <Button disabled={createProject.isPending || updateProject.isPending} type="submit">
              {createProject.isPending || updateProject.isPending
                ? "Saving..."
                : editingProjectId
                  ? "Update Project"
                  : "Add Project"}
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        headers={[
          "Project Name/Title",
          "Project Code (Budget Line)",
          "Sub-County",
          "Ward",
          "GPS",
          "Project Start Date",
          "Approved Project Cost",
          "Project Status",
          "% Completion",
          "Actions"
        ]}
        rows={rows}
        emptyLabel={getSearchEmptyLabel({
          searchTerm: searchTerm || (statusFilter !== "ALL" || subCountyFilter !== "ALL" ? "selected filters" : ""),
          isLoading,
          loadingLabel: "Loading projects...",
          emptyLabel: "No projects found."
        })}
      />
    </section>
  );
};

export default ProjectsPage;
