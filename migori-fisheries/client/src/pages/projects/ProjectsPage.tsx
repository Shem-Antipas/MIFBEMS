import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { projectsApi, type CreateProjectPayload } from "@/api/projects";
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

  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);

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
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) =>
      projectsApi.update(id, { status, completionPercent: status === "COMPLETED" ? 100 : undefined }),
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

  const rows = useMemo(
    () =>
      projects.map((project) => {
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
          canUpdateProjectStatus || canDeleteProject ? (
            <div className="flex items-center gap-2">
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
                        await updateProject.mutateAsync({ id: project.id, status: selectedStatus });
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
    [projects, statusDrafts, canUpdateProjectStatus, canDeleteProject, updateProject, deleteProject]
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Blue Economy Projects</h1>
        <ExportButton
          filename="blue-economy-projects"
          sheetName="Projects"
          columns={projectExportColumns}
          rows={projects}
        />
      </div>

      {canCreateProject ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px]">
              <label className="mb-1 block text-sm font-medium">Bulk import projects (Excel/CSV)</label>
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setImportFile(file);
                }}
              />
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

              await createProject.mutateAsync({
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
              });
              toast.success("Project added successfully");
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
            } catch (error) {
              const message =
                (error as AxiosError<{ error?: string }>).response?.data?.error ??
                "Failed to add project.";
              toast.error(message);
            }
          })}
        >
          <Input placeholder="Project Name/Title" {...register("name", { required: true })} />
          <Input placeholder="Project Code (Budget Line)" {...register("budgetLine")} />
          <Input type="number" step="0.1" placeholder="Approved Project Cost (KES)" {...register("budget", { valueAsNumber: true })} />

          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("category")}>
            {projectCategoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>

          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
          >
            {PROJECT_SUBCOUNTY_OPTIONS.map((subCounty) => (
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

          <Input type="date" {...register("startDate", { required: true })} />
          <Input type="number" min={0} max={100} step="1" placeholder="% Completion" {...register("completionPercent", { valueAsNumber: true })} />

          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("status")}>
            {projectStatusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <Input type="number" step="0.00001" placeholder={`Latitude (${wardLocation.lat.toFixed(5)})`} {...register("latitude", { valueAsNumber: true })} />
          <Input type="number" step="0.00001" placeholder={`Longitude (${wardLocation.lng.toFixed(5)})`} {...register("longitude", { valueAsNumber: true })} />
          <Input placeholder="Funder" {...register("funder", { required: true })} />
          <Input className="md:col-span-3" placeholder="Project description" {...register("description", { required: true })} />

          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-medium">Project images (attach files)</label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setSelectedImageFiles(files);
              }}
            />
            {selectedImageFiles.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Attached: {selectedImageFiles.map((file) => file.name).join(", ")}
              </p>
            ) : null}
          </div>

          <Input type="date" {...register("endDate")} />

          <div className="flex justify-end md:col-span-3">
            <Button disabled={createProject.isPending} type="submit">
              {createProject.isPending ? "Saving..." : "Add Project"}
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
        emptyLabel={isLoading ? "Loading projects..." : "No projects found."}
      />
    </section>
  );
};

export default ProjectsPage;
