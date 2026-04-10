import { useQuery } from "@tanstack/react-query";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { projectsApi } from "@/api/projects";

const ProjectsPage = () => {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list
  });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Blue Economy Projects</h1>
      <DataTable
        headers={["Project", "Sub-County", "Budget", "Funder", "Status"]}
        rows={projects.map((project) => [
          project.name,
          project.subCounty,
          `KES ${project.budget.toLocaleString()}`,
          project.funder,
          <StatusBadge key={project.id} status={project.status} />
        ])}
        emptyLabel={isLoading ? "Loading projects..." : "No projects found."}
      />
    </section>
  );
};

export default ProjectsPage;
