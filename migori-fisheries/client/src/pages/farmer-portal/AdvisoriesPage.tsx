import { useQuery } from "@tanstack/react-query";
import { advisoriesApi } from "@/api/advisories";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { Advisory } from "@/types";

const advisoryExportColumns = [
  { header: "Title", value: "title" },
  { header: "Type", value: "type" },
  { header: "Message", value: "message" },
  { header: "From", value: "fromName" },
  { header: "Sub-County", value: (advisory: Advisory) => advisory.subCounty ?? "All" },
  { header: "Date", value: (advisory: Advisory) => new Date(advisory.createdAt) }
] satisfies Array<ExcelColumn<Advisory>>;

const AdvisoriesPage = () => {
  const { data: advisories = [], isLoading } = useQuery({
    queryKey: ["advisories"],
    queryFn: advisoriesApi.list
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Advisories</h1>
        <ExportButton
          filename="advisories"
          sheetName="Advisories"
          columns={advisoryExportColumns}
          rows={advisories}
        />
      </div>
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
