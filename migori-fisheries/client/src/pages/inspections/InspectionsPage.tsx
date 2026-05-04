import { useQuery } from "@tanstack/react-query";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { inspectionsApi } from "@/api/inspections";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { Inspection } from "@/types";

const inspectionExportColumns = [
  { header: "Farm", value: "farmName" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Date", value: (inspection: Inspection) => new Date(inspection.date) },
  { header: "Result", value: "result" },
  { header: "Notes", value: (inspection: Inspection) => inspection.notes ?? "" },
  { header: "Created At", value: (inspection: Inspection) => new Date(inspection.createdAt) }
] satisfies Array<ExcelColumn<Inspection>>;

const InspectionsPage = () => {
  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: inspectionsApi.list
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Inspection Reports</h1>
        <ExportButton
          filename="inspection-reports"
          sheetName="Inspections"
          columns={inspectionExportColumns}
          rows={inspections}
        />
      </div>
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
