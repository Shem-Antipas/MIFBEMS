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
import { getWardCoordinates, MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY } from "@/lib/locationData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { BlueEconomyProject } from "@/types";

type ProjectStatus = BlueEconomyProject["status"];
type ProjectCategory = BlueEconomyProject["category"];

const projectStatusOptions: Array<{ value: ProjectStatus; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "STALLED", label: "Stalled" },
  { value: "PLANNED", label: "Planned (Legacy)" },
  { value: "ONGOING", label: "Ongoing (Legacy)" },
  { value: "CANCELLED", label: "Cancelled (Legacy)" }
];

const projectCategoryOptions: Array<{ value: ProjectCategory; label: string }> = [
  { value: "BLUE_ECONOMY", label: "Blue Economy" },
  { value: "LAKEFRONT_DEVELOPMENT", label: "Lakefront Development" },
  { value: "AQUACULTURE_DEVELOPMENT", label: "Aquaculture Development" }
];

type ProjectForm = {
  category: ProjectCategory;
  name: string;
  description: string;
  subCounty: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  budget: number;
  funder: string;
  status: ProjectStatus;
  photos: string;
  startDate: string;
  endDate?: string;
};

const formatStatus = (status: ProjectStatus): string =>
  projectStatusOptions.find((option) => option.value === status)?.label ?? status;

const formatCategory = (category: ProjectCategory): string =>
  projectCategoryOptions.find((option) => option.value === category)?.label ?? category;

const projectExportColumns = [
  { header: "Unique Number", value: "projectCode" },
  { header: "Category", value: (project: BlueEconomyProject) => formatCategory(project.category) },
  { header: "Project Name", value: "name" },
  { header: "Project Amount", value: "budget" },
  { header: "Funder", value: "funder" },
  { header: "Project Description", value: "description" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: "ward" },
  { header: "Latitude", value: (project: BlueEconomyProject) => project.latitude ?? "" },
  { header: "Longitude", value: (project: BlueEconomyProject) => project.longitude ?? "" },
  { header: "Status", value: (project: BlueEconomyProject) => formatStatus(project.status) },
  { header: "Photos", value: (project: BlueEconomyProject) => project.photos.join(", ") },
  { header: "Responsible Officer", value: (project: BlueEconomyProject) => project.responsibleOfficerName ?? "" },
  { header: "Start Date", value: (project: BlueEconomyProject) => new Date(project.startDate) },
  { header: "End Date", value: (project: BlueEconomyProject) => project.endDate ? new Date(project.endDate) : "" }
] satisfies Array<ExcelColumn<BlueEconomyProject>>;

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list
  });

  const { register, handleSubmit, reset, control, setValue } = useForm<ProjectForm>({
    defaultValues: {
      category: "BLUE_ECONOMY",
      name: "",
      description: "",
      subCounty: user?.subCounty ?? "Suna East",
      ward: WARDS_BY_SUBCOUNTY[(user?.subCounty as keyof typeof WARDS_BY_SUBCOUNTY) ?? "Suna East"]?.[0] ?? "God Jope",
      budget: 0,
      funder: "",
      status: "PENDING",
      photos: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: ""
    }
  });

  const selectedSubCounty = useWatch({ control, name: "subCounty", defaultValue: user?.subCounty ?? "Suna East" });
  const selectedWard = useWatch({ control, name: "ward", defaultValue: "God Jope" });
  const availableWards = WARDS_BY_SUBCOUNTY[selectedSubCounty as keyof typeof WARDS_BY_SUBCOUNTY] ?? WARDS_BY_SUBCOUNTY["Suna East"];
  const wardLocation = getWardCoordinates(selectedSubCounty as keyof typeof WARDS_BY_SUBCOUNTY, selectedWard);

  const canCreateProject = user?.role === "DIRECTOR" || user?.role === "FISHERIES_OFFICER";
  const canUpdateProjectStatus = user?.role === "DIRECTOR";

  const createProject = useMutation({
    mutationFn: (payload: CreateProjectPayload) => projectsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] });
    }
  });

  const updateProject = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) => projectsApi.update(id, { status }),
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

        return [
          project.projectCode,
          formatCategory(project.category),
          project.name,
          project.subCounty,
          project.ward,
          `KES ${project.budget.toLocaleString()}`,
          project.responsibleOfficerName ?? "-",
          <StatusBadge key={project.id} status={formatStatus(project.status)} />,
          canUpdateProjectStatus ? (
            <div className="flex items-center gap-2">
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
            </div>
          ) : (
            "-"
          )
        ];
      }),
    [projects, statusDrafts, canUpdateProjectStatus, updateProject]
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
        <form
          className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"
          onSubmit={handleSubmit(async (values) => {
            try {
              const photos = values.photos
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);

              await createProject.mutateAsync({
                category: values.category,
                name: values.name,
                description: values.description,
                subCounty: values.subCounty,
                ward: values.ward,
                latitude: Number.isFinite(values.latitude) ? values.latitude : wardLocation.lat,
                longitude: Number.isFinite(values.longitude) ? values.longitude : wardLocation.lng,
                budget: Number(values.budget),
                funder: values.funder,
                status: values.status,
                photos,
                startDate: values.startDate,
                endDate: values.endDate || null
              });
              toast.success("Project added successfully");
              reset({
                category: "BLUE_ECONOMY",
                name: "",
                description: "",
                subCounty: user?.subCounty ?? "Suna East",
                ward: WARDS_BY_SUBCOUNTY[(user?.subCounty as keyof typeof WARDS_BY_SUBCOUNTY) ?? "Suna East"]?.[0] ?? "God Jope",
                budget: 0,
                funder: "",
                status: "PENDING",
                photos: "",
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
          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("category")}>
            {projectCategoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <Input placeholder="Project name" {...register("name", { required: true })} />
          <Input type="number" step="0.1" placeholder="Project amount (KES)" {...register("budget", { valueAsNumber: true })} />
          <Input className="md:col-span-3" placeholder="Project description" {...register("description", { required: true })} />
          <Input placeholder="Funder" {...register("funder", { required: true })} />
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
          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("status")}>
            {projectStatusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <Input type="number" step="0.00001" placeholder={`Latitude (${wardLocation.lat.toFixed(5)})`} {...register("latitude", { valueAsNumber: true })} />
          <Input type="number" step="0.00001" placeholder={`Longitude (${wardLocation.lng.toFixed(5)})`} {...register("longitude", { valueAsNumber: true })} />
          <Input placeholder="Photo URLs, comma separated" {...register("photos")} />
          <Input type="date" {...register("startDate", { required: true })} />
          <Input type="date" {...register("endDate")} />
          <div className="flex justify-end md:col-span-3">
            <Button disabled={createProject.isPending} type="submit">
              {createProject.isPending ? "Saving..." : "Add Project"}
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        headers={["Unique No", "Category", "Project", "Sub-County", "Ward", "Amount", "Responsible Officer", "Status", "Actions"]}
        rows={rows}
        emptyLabel={isLoading ? "Loading projects..." : "No projects found."}
      />
    </section>
  );
};

export default ProjectsPage;
