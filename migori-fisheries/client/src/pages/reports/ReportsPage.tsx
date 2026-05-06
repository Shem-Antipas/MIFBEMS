import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import ExportButton from "@/components/shared/ExportButton";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { captureFisheriesApi } from "@/api/captureFisheries";
import { inspectionsApi } from "@/api/inspections";
import { projectsApi } from "@/api/projects";
import { reportsApi } from "@/api/reports";
import { useFarmers } from "@/hooks/useFarmers";
import { useLicenses } from "@/hooks/useLicenses";
import { MIGORI_SUBCOUNTIES } from "@/lib/locationData";
import type { ExcelColumn } from "@/lib/exportToExcel";
import { getSearchEmptyLabel } from "@/lib/search";

type ReportExportRow = {
  section: string;
  metric: string;
  value: string | number;
};

type NameValueRow = {
  name: string;
  value: number;
};

type SubCountyReportRow = {
  subCounty: string;
  farmers: number;
  productionKg: number;
  licenses: number;
  validLicenses: number;
  projects: number;
  inspections: number;
};

const reportExportColumns = [
  { header: "Section", value: "section" },
  { header: "Metric", value: "metric" },
  { header: "Value", value: "value" }
] satisfies Array<ExcelColumn<ReportExportRow>>;

const chartColors = ["#0f766e", "#2563eb", "#7c3aed", "#ea580c", "#16a34a", "#ca8a04", "#be123c", "#0891b2"];
const statusColors: Record<string, string> = {
  ACTIVE: "#16a34a",
  INACTIVE: "#6b7280",
  SUSPENDED: "#dc2626",
  VALID: "#16a34a",
  PENDING: "#ca8a04",
  EXPIRED: "#dc2626",
  REVOKED: "#6b7280",
  REJECTED: "#be123c",
  COMPLETED: "#16a34a",
  ONGOING: "#ca8a04",
  PLANNED: "#2563eb",
  CANCELLED: "#6b7280",
  PASS: "#16a34a",
  FAIL: "#dc2626"
};

const formatNumber = (value: number, maximumFractionDigits = 0): string =>
  value.toLocaleString(undefined, { maximumFractionDigits });

const formatKg = (value: number): string => `${formatNumber(value)} kg`;
const formatTooltipKg = (value: unknown): string => formatKg(Number(value ?? 0));
const getShare = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0);
const formatDisplayValue = (value: number, total: number, mode: "FIGURE" | "PERCENT", suffix = ""): string =>
  mode === "PERCENT" ? `${formatNumber(getShare(value, total), 1)}%` : `${formatNumber(value)}${suffix}`;

const ChartCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card>
    <CardHeader className="p-4 pb-2">
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="h-72 p-4 pt-2">{children}</CardContent>
  </Card>
);

const countBy = <T,>(items: T[], getKey: (item: T) => string | null | undefined): NameValueRow[] => {
  const totals = items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(totals).map(([name, value]) => ({ name, value }));
};

const ReportsPage = () => {
  const [selectedSubCounty, setSelectedSubCounty] = useState<string>("All");
  const [valueDisplayMode, setValueDisplayMode] = useState<"FIGURE" | "PERCENT">("FIGURE");
  const [searchTerm, setSearchTerm] = useState("");
  const summarySubCounty = selectedSubCounty === "All" ? undefined : selectedSubCounty;

  const { data: reportData, isLoading: isReportLoading } = useQuery({
    queryKey: ["reports", "summary", summarySubCounty ?? "all"],
    queryFn: () => reportsApi.summary(summarySubCounty)
  });
  const { data: farmers = [], isLoading: isFarmersLoading } = useFarmers();
  const { data: licenses = [], isLoading: isLicensesLoading } = useLicenses();
  const { data: projects = [], isLoading: isProjectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list
  });
  const { data: inspections = [], isLoading: isInspectionsLoading } = useQuery({
    queryKey: ["inspections"],
    queryFn: inspectionsApi.list
  });
  const { data: captureRecords = [], isLoading: isCaptureLoading } = useQuery({
    queryKey: ["capture-fisheries"],
    queryFn: captureFisheriesApi.list
  });

  const isLoading =
    isReportLoading || isFarmersLoading || isLicensesLoading || isProjectsLoading || isInspectionsLoading || isCaptureLoading;

  const filteredFarmers = useMemo(
    () =>
      selectedSubCounty === "All"
        ? farmers
        : farmers.filter((farmer) => farmer.subCounty === selectedSubCounty),
    [farmers, selectedSubCounty]
  );

  const filteredLicenses = useMemo(
    () =>
      selectedSubCounty === "All"
        ? licenses
        : licenses.filter((license) => license.farmer?.subCounty === selectedSubCounty),
    [licenses, selectedSubCounty]
  );

  const filteredProjects = useMemo(
    () =>
      selectedSubCounty === "All"
        ? projects
        : projects.filter((project) => project.subCounty === selectedSubCounty),
    [projects, selectedSubCounty]
  );

  const filteredInspections = useMemo(
    () =>
      selectedSubCounty === "All"
        ? inspections
        : inspections.filter((inspection) => inspection.subCounty === selectedSubCounty),
    [inspections, selectedSubCounty]
  );

  const filteredCaptureRecords = useMemo(
    () =>
      selectedSubCounty === "All"
        ? captureRecords
        : captureRecords.filter((record) => record.subCounty === selectedSubCounty),
    [captureRecords, selectedSubCounty]
  );

  const subCountyRows = useMemo<SubCountyReportRow[]>(() => {
    const visibleSubCounties = selectedSubCounty === "All" ? MIGORI_SUBCOUNTIES : [selectedSubCounty];

    return visibleSubCounties.map((subCounty) => {
      const farmersInSubCounty = farmers.filter((farmer) => farmer.subCounty === subCounty);
      const licensesInSubCounty = licenses.filter((license) => license.farmer?.subCounty === subCounty);
      const projectsInSubCounty = projects.filter((project) => project.subCounty === subCounty);
      const inspectionsInSubCounty = inspections.filter((inspection) => inspection.subCounty === subCounty);
      const farmProduction = farmersInSubCounty.reduce((total, farmer) => total + farmer.productionKg, 0);
      const captureProduction = captureRecords
        .filter((record) => record.subCounty === subCounty)
        .reduce((total, record) => total + record.catchKg, 0);

      return {
        subCounty,
        farmers: farmersInSubCounty.length,
        productionKg: farmProduction + captureProduction,
        licenses: licensesInSubCounty.length,
        validLicenses: licensesInSubCounty.filter((license) => license.status === "VALID").length,
        projects: projectsInSubCounty.length,
        inspections: inspectionsInSubCounty.length
      };
    });
  }, [captureRecords, farmers, inspections, licenses, projects, selectedSubCounty]);

  const filteredSubCountyRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return subCountyRows;

    return subCountyRows.filter((row) =>
      [
        row.subCounty,
        String(row.farmers),
        String(row.productionKg),
        String(row.licenses),
        String(row.validLicenses),
        String(row.projects),
        String(row.inspections)
      ].some((value) => value.toLowerCase().includes(term))
    );
  }, [searchTerm, subCountyRows]);

  const totalProductionKg = subCountyRows.reduce((total, row) => total + row.productionKg, 0);
  const activeLicenses = filteredLicenses.filter((license) => license.status === "VALID").length;
  const expiredLicenses = filteredLicenses.filter((license) => license.status === "EXPIRED").length;
  const ongoingProjects = filteredProjects.filter((project) => project.status === "ONGOING").length;
  const captureProductionKg = filteredCaptureRecords.reduce((total, record) => total + record.catchKg, 0);

  const licenseRows = useMemo(() => countBy(filteredLicenses, (license) => license.status), [filteredLicenses]);
  const farmerStatusRows = useMemo(() => countBy(filteredFarmers, (farmer) => farmer.status), [filteredFarmers]);
  const projectRows = useMemo(() => countBy(filteredProjects, (project) => project.status), [filteredProjects]);
  const inspectionRows = useMemo(() => countBy(filteredInspections, (inspection) => inspection.result), [filteredInspections]);

  const filteredLicenseRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return licenseRows;

    return licenseRows.filter((row) =>
      [row.name, String(row.value)].some((value) => value.toLowerCase().includes(term))
    );
  }, [licenseRows, searchTerm]);

  const exportRows = useMemo<ReportExportRow[]>(() => {
    const summaryRows: ReportExportRow[] = [
      { section: "Summary", metric: "Scope", value: selectedSubCounty },
      { section: "Summary", metric: "Total Farmers", value: reportData?.summary.totalFarmers ?? filteredFarmers.length },
      { section: "Summary", metric: "Active Licenses", value: reportData?.summary.activeLicenses ?? activeLicenses },
      { section: "Summary", metric: "Expired Licenses", value: reportData?.summary.expiredLicenses ?? expiredLicenses },
      { section: "Summary", metric: "Total Projects", value: reportData?.summary.totalProjects ?? filteredProjects.length },
      { section: "Summary", metric: "Ongoing Projects", value: reportData?.summary.ongoingProjects ?? ongoingProjects },
      { section: "Summary", metric: "Total Production (Kg)", value: totalProductionKg },
      { section: "Summary", metric: "Capture Fisheries (Kg)", value: captureProductionKg },
      { section: "Summary", metric: "Inspections", value: filteredInspections.length }
    ];

    return [
      ...summaryRows,
      ...subCountyRows.map((row) => ({
        section: "Sub-County Report",
        metric: row.subCounty,
        value: `${formatNumber(row.productionKg)} kg, ${formatNumber(row.farmers)} farmers, ${formatNumber(row.licenses)} licenses`
      })),
      ...licenseRows.map((row) => ({ section: "License Status", metric: row.name, value: row.value })),
      ...farmerStatusRows.map((row) => ({ section: "Farmer Status", metric: row.name, value: row.value })),
      ...projectRows.map((row) => ({ section: "Project Status", metric: row.name, value: row.value })),
      ...inspectionRows.map((row) => ({ section: "Inspection Result", metric: row.name, value: row.value }))
    ];
  }, [
    activeLicenses,
    captureProductionKg,
    expiredLicenses,
    farmerStatusRows,
    filteredFarmers.length,
    filteredInspections.length,
    filteredProjects.length,
    inspectionRows,
    licenseRows,
    ongoingProjects,
    projectRows,
    reportData,
    selectedSubCounty,
    subCountyRows,
    totalProductionKg
  ]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading live reports...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reports & Exports</h1>
          <p className="text-sm text-muted-foreground">
            Live operational reports from farmers, licenses, capture fisheries, projects, and inspections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search report tables..."
            className="w-56"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={valueDisplayMode}
            onChange={(event) => setValueDisplayMode(event.target.value as "FIGURE" | "PERCENT")}
          >
            <option value="FIGURE">Display: Figure</option>
            <option value="PERCENT">Display: Percent</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedSubCounty}
            onChange={(event) => setSelectedSubCounty(event.target.value)}
          >
            <option value="All">All Sub-Counties</option>
            {MIGORI_SUBCOUNTIES.map((subCounty) => (
              <option key={subCounty} value={subCounty}>
                {subCounty}
              </option>
            ))}
          </select>
          <ExportButton
            filename="reports-live-summary"
            sheetName="Reports"
            columns={reportExportColumns}
            rows={exportRows}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Farmers" value={reportData?.summary.totalFarmers ?? filteredFarmers.length} />
        <StatCard label="Total Production" value={formatKg(totalProductionKg)} helper={`${formatNumber(totalProductionKg / 1000, 2)} MT`} />
        <StatCard label="Active Licenses" value={reportData?.summary.activeLicenses ?? activeLicenses} />
        <StatCard label="Projects" value={reportData?.summary.totalProjects ?? filteredProjects.length} helper={`${formatNumber(ongoingProjects)} ongoing`} />
        <StatCard label="Inspections" value={reportData?.summary.inspectionsThisYear ?? filteredInspections.length} helper="Current visible scope" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <ChartCard title="Production by Sub-County">
          {subCountyRows.some((row) => row.productionKg > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subCountyRows} margin={{ left: 0, right: 8, bottom: 18 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="subCounty" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={11} tickFormatter={(value: number) => formatNumber(value / 1000, 1)} />
                <Tooltip formatter={formatTooltipKg} />
                <Bar dataKey="productionKg" name="Production" fill="#0f766e" radius={[6, 6, 0, 0]}>
                  <LabelList
                    dataKey="productionKg"
                    position="top"
                    formatter={(value) =>
                      formatDisplayValue(
                        Number(value),
                        subCountyRows.reduce((sum, row) => sum + row.productionKg, 0),
                        valueDisplayMode,
                        valueDisplayMode === "FIGURE" ? " kg" : ""
                      )
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No production records available.</div>
          )}
        </ChartCard>

        <ChartCard title="License Status Mix">
          {licenseRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={licenseRows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={88}
                  label={(entry) =>
                    formatDisplayValue(
                      Number(entry?.value ?? 0),
                      licenseRows.reduce((sum, row) => sum + row.value, 0),
                      valueDisplayMode
                    )
                  }
                >
                  {licenseRows.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] ?? chartColors[0]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No license records available.</div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Farmer Status">
          {farmerStatusRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={farmerStatusRows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={88}
                  label={(entry) =>
                    formatDisplayValue(
                      Number(entry?.value ?? 0),
                      farmerStatusRows.reduce((sum, row) => sum + row.value, 0),
                      valueDisplayMode
                    )
                  }
                >
                  {farmerStatusRows.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] ?? chartColors[1]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No farmer records available.</div>
          )}
        </ChartCard>

        <ChartCard title="Project Status">
          {projectRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectRows} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={78} />
                <Tooltip />
                <Bar dataKey="value" name="Projects" radius={[0, 6, 6, 0]}>
                  {projectRows.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] ?? chartColors[2]} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value) =>
                      formatDisplayValue(
                        Number(value),
                        projectRows.reduce((sum, row) => sum + row.value, 0),
                        valueDisplayMode
                      )
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No project records available.</div>
          )}
        </ChartCard>

        <ChartCard title="Inspection Results">
          {inspectionRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inspectionRows} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={78} />
                <Tooltip />
                <Bar dataKey="value" name="Inspections" radius={[0, 6, 6, 0]}>
                  {inspectionRows.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] ?? chartColors[3]} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value) =>
                      formatDisplayValue(
                        Number(value),
                        inspectionRows.reduce((sum, row) => sum + row.value, 0),
                        valueDisplayMode
                      )
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No inspection records available.</div>
          )}
        </ChartCard>
      </div>

      <DataTable
        headers={["Sub-County", "Farmers", "Production", "Licenses", "Valid Licenses", "Projects", "Inspections"]}
        rows={filteredSubCountyRows.map((row) => [
          row.subCounty,
          formatNumber(row.farmers),
          formatKg(row.productionKg),
          formatNumber(row.licenses),
          formatNumber(row.validLicenses),
          formatNumber(row.projects),
          formatNumber(row.inspections)
        ])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm,
          isLoading,
          loadingLabel: "Loading report records...",
          emptyLabel: "No report records available."
        })}
      />

      <DataTable
        headers={["License Status", "Count"]}
        rows={filteredLicenseRows.map((row) => [<StatusBadge key={row.name} status={row.name} />, formatNumber(row.value)])}
        emptyLabel={getSearchEmptyLabel({
          searchTerm,
          isLoading,
          loadingLabel: "Loading license status records...",
          emptyLabel: "No license status records available."
        })}
      />
    </section>
  );
};

export default ReportsPage;
