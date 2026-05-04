import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { projectsApi, type CreateProjectPayload } from "@/api/projects";
import { useAuthStore } from "@/store/authStore";
import { MIGORI_SUBCOUNTIES } from "@/lib/locationData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProjectStatus = "PLANNED" | "ONGOING" | "COMPLETED" | "CANCELLED";
const projectStatusOptions: ProjectStatus[] = ["PLANNED", "ONGOING", "COMPLETED", "CANCELLED"];

type ProjectForm = {
  name: string;
  subCounty: string;
  budget: number;
  funder: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
};

const ProjectsPage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list
  });

  const { register, handleSubmit, reset } = useForm<ProjectForm>({
    defaultValues: {
      name: "",
      subCounty: user?.subCounty ?? "Suna East",
      budget: 0,
      funder: "",
      status: "PLANNED",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: ""
    }
  });

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
          project.name,
          project.subCounty,
          `KES ${project.budget.toLocaleString()}`,
          project.funder,
          <StatusBadge key={project.id} status={project.status} />,
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
                  <option key={status} value={status}>
                    {status}
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
      <h1 className="text-xl font-semibold">Blue Economy Projects</h1>

      {canCreateProject ? (
        <form
          className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"
          onSubmit={handleSubmit(async (values) => {
            try {
              await createProject.mutateAsync({
                name: values.name,
                subCounty: values.subCounty,
                budget: Number(values.budget),
                funder: values.funder,
                status: values.status,
                startDate: values.startDate,
                endDate: values.endDate || null
              });
              toast.success("Project added successfully");
              reset({
                name: "",
                subCounty: user?.subCounty ?? "Suna East",
                budget: 0,
                funder: "",
                status: "PLANNED",
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
          <Input placeholder="Project name" {...register("name", { required: true })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("subCounty", { required: true })}>
            {MIGORI_SUBCOUNTIES.map((subCounty) => (
              <option key={subCounty} value={subCounty}>
                {subCounty}
              </option>
            ))}
          </select>
          <Input type="number" step="0.1" placeholder="Budget (KES)" {...register("budget", { valueAsNumber: true })} />
          <Input placeholder="Funder" {...register("funder", { required: true })} />
          <select className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("status")}>
            {projectStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <Input type="date" {...register("startDate", { required: true })} />
          <Input type="date" {...register("endDate")} />
          <div className="md:col-span-3 flex justify-end">
            <Button disabled={createProject.isPending} type="submit">
              {createProject.isPending ? "Saving..." : "Add Project"}
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        headers={["Project", "Sub-County", "Budget", "Funder", "Status", "Actions"]}
        rows={rows}
        emptyLabel={isLoading ? "Loading projects..." : "No projects found."}
      />
    </section>
  );
};

export default ProjectsPage;
