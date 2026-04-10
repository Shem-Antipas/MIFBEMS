import { useQuery } from "@tanstack/react-query";
import { advisoriesApi } from "@/api/advisories";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";

const AdvisoriesPage = () => {
  const { data: advisories = [], isLoading } = useQuery({
    queryKey: ["advisories"],
    queryFn: advisoriesApi.list
  });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Advisories</h1>
      <DataTable
        headers={["Title", "Type", "Message", "From", "Date"]}
        rows={advisories.map((advisory) => [
          advisory.title,
          <StatusBadge key={advisory.id} status={advisory.type} />,
          advisory.message,
          advisory.fromName,
          new Date(advisory.createdAt).toLocaleDateString()
        ])}
        emptyLabel={isLoading ? "Loading advisories..." : "No advisories yet."}
      />
    </section>
  );
};

export default AdvisoriesPage;
