import { useQuery } from "@tanstack/react-query";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { inspectionsApi } from "@/api/inspections";

const InspectionsPage = () => {
  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: inspectionsApi.list
  });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Inspection Reports</h1>
      <DataTable
        headers={["Farm", "Sub-County", "Date", "Result", "Notes"]}
        rows={inspections.map((inspection) => [
          inspection.farmName,
          inspection.subCounty,
          new Date(inspection.date).toLocaleDateString(),
          <StatusBadge key={inspection.id} status={inspection.result} />,
          inspection.notes ?? "-"
        ])}
        emptyLabel={isLoading ? "Loading inspections..." : "No inspection records found."}
      />
    </section>
  );
};

export default InspectionsPage;
