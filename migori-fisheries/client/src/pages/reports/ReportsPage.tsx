import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { useFarmers } from "@/hooks/useFarmers";
import { useLicenses } from "@/hooks/useLicenses";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY, type MigoriSubCounty } from "@/lib/locationData";
import type { ExcelColumn } from "@/lib/exportToExcel";
import { getSearchEmptyLabel } from "@/lib/search";

type NameValueRow = {
  name: string;
  value: number;
};

type SummaryReportRow = {
  metric: string;
  value: string | number;
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

type DemographicReportRow = {
  scope: string;
  subCounty: string;
  ward: string;
  farmers: number;
  male: number;
  female: number;
  youth: number;
  adult: number;
  unspecifiedGender: number;
  unspecifiedAge: number;
  productionKg: number;
};

type StatusReportRow = {
  status: string;
  count: number;
};

const summaryExportColumns = [
  { header: "Metric", value: "metric" },
  { header: "Value", value: "value" }
] satisfies Array<ExcelColumn<SummaryReportRow>>;

const subCountyExportColumns = [
  { header: "Sub-County", value: "subCounty" },
  { header: "Farmers", value: "farmers" },
  { header: "Production (Kg)", value: "productionKg" },
  { header: "Licenses", value: "licenses" },
  { header: "Valid Licenses", value: "validLicenses" },
  { header: "Projects", value: "projects" },
  { header: "Extension Services", value: "inspections" }
] satisfies Array<ExcelColumn<SubCountyReportRow>>;

const demographicExportColumns = [
  { header: "Scope", value: "scope" },
  { header: "Sub-County", value: "subCounty" },
  { header: "Ward", value: "ward" },
  { header: "Farmers", value: "farmers" },
  { header: "Male", value: "male" },
  { header: "Female", value: "female" },
  { header: "Youth", value: "youth" },
  { header: "Adult", value: "adult" },
  { header: "Unspecified Gender", value: "unspecifiedGender" },
  { header: "Unspecified Age", value: "unspecifiedAge" },
  { header: "Production (Kg)", value: "productionKg" }
] satisfies Array<ExcelColumn<DemographicReportRow>>;

const statusExportColumns = [
  { header: "Status", value: "status" },
  { header: "Count", value: "count" }
] satisfies Array<ExcelColumn<StatusReportRow>>;

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

const toStatusExportRows = (rows: NameValueRow[]): StatusReportRow[] =>
  rows.map((row) => ({
    status: row.name,
    count: row.value
  }));

const ReportsPage = () => {
  const [selectedSubCounty, setSelectedSubCounty] = useState<string>("All");
  const [selectedWard, setSelectedWard] = useState<string>("All");
  const [valueDisplayMode, setValueDisplayMode] = useState<"FIGURE" | "PERCENT">("FIGURE");
  const [searchTerm, setSearchTerm] = useState("");
  const availableWards =
    selectedSubCounty !== "All" && MIGORI_SUBCOUNTIES.includes(selectedSubCounty as MigoriSubCounty)
      ? WARDS_BY_SUBCOUNTY[selectedSubCounty as MigoriSubCounty]
      : [];

  useEffect(() => {
    setSelectedWard("All");
  }, [selectedSubCounty]);

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
    isFarmersLoading || isLicensesLoading || isProjectsLoading || isInspectionsLoading || isCaptureLoading;

  const filteredFarmers = useMemo(
    () =>
      farmers.filter((farmer) => {
        const subCountyMatches = selectedSubCounty === "All" || farmer.subCounty === selectedSubCounty;
        const wardMatches = selectedWard === "All" || farmer.ward === selectedWard;
        return subCountyMatches && wardMatches;
      }),
    [farmers, selectedSubCounty, selectedWard]
  );

  const filteredLicenses = useMemo(
    () =>
      licenses.filter((license) => {
        const subCounty = license.farmer?.subCounty ?? license.subCounty;
        const ward = license.farmer?.ward ?? license.ward;
        const subCountyMatches = selectedSubCounty === "All" || subCounty === selectedSubCounty;
        const wardMatches = selectedWard === "All" || ward === selectedWard;
        return subCountyMatches && wardMatches;
      }),
    [licenses, selectedSubCounty, selectedWard]
  );

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const subCountyMatches = selectedSubCounty === "All" || project.subCounty === selectedSubCounty;
        const wardMatches = selectedWard === "All" || project.ward === selectedWard || project.ward === "All wards";
        return subCountyMatches && wardMatches;
      }),
    [projects, selectedSubCounty, selectedWard]
  );

  const filteredInspections = useMemo(
    () =>
      inspections.filter((inspection) => {
        const subCountyMatches = selectedSubCounty === "All" || inspection.subCounty === selectedSubCounty;
        const wardMatches = selectedWard === "All" || inspection.ward === selectedWard;
        return subCountyMatches && wardMatches;
      }),
    [inspections, selectedSubCounty, selectedWard]
  );

  const filteredCaptureRecords = useMemo(
    () =>
      captureRecords.filter((record) => {
        const subCountyMatches = selectedSubCounty === "All" || record.subCounty === selectedSubCounty;
        const wardMatches = selectedWard === "All" || record.ward === selectedWard;
        return subCountyMatches && wardMatches;
      }),
    [captureRecords, selectedSubCounty, selectedWard]
  );

  const subCountyRows = useMemo<SubCountyReportRow[]>(() => {
    const visibleSubCounties = selectedSubCounty === "All" ? MIGORI_SUBCOUNTIES : [selectedSubCounty];

    return visibleSubCounties.map((subCounty) => {
      const farmersInSubCounty = farmers.filter(
        (farmer) => farmer.subCounty === subCounty && (selectedWard === "All" || farmer.ward === selectedWard)
      );
      const licensesInSubCounty = licenses.filter((license) => {
        const licenseSubCounty = license.farmer?.subCounty ?? license.subCounty;
        const licenseWard = license.farmer?.ward ?? license.ward;
        return licenseSubCounty === subCounty && (selectedWard === "All" || licenseWard === selectedWard);
      });
      const projectsInSubCounty = projects.filter(
        (project) =>
          project.subCounty === subCounty &&
          (selectedWard === "All" || project.ward === selectedWard || project.ward === "All wards")
      );
      const inspectionsInSubCounty = inspections.filter(
        (inspection) => inspection.subCounty === subCounty && (selectedWard === "All" || inspection.ward === selectedWard)
      );
      const farmProduction = farmersInSubCounty.reduce((total, farmer) => total + farmer.productionKg, 0);
      const captureProduction = captureRecords
        .filter((record) => record.subCounty === subCounty && (selectedWard === "All" || record.ward === selectedWard))
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
  }, [captureRecords, farmers, inspections, licenses, projects, selectedSubCounty, selectedWard]);

  const demographicRows = useMemo<DemographicReportRow[]>(() => {
    const buildRow = (scope: string, subCounty: string, ward: string, visibleFarmers: typeof farmers): DemographicReportRow => ({
      scope,
      subCounty,
      ward,
      farmers: visibleFarmers.length,
      male: visibleFarmers.filter((farmer) => farmer.gender === "MALE").length,
      female: visibleFarmers.filter((farmer) => farmer.gender === "FEMALE").length,
      youth: visibleFarmers.filter((farmer) => farmer.ageBracket === "YOUTH").length,
      adult: visibleFarmers.filter((farmer) => farmer.ageBracket === "ADULT").length,
      unspecifiedGender: visibleFarmers.filter((farmer) => !farmer.gender).length,
      unspecifiedAge: visibleFarmers.filter((farmer) => !farmer.ageBracket).length,
      productionKg: visibleFarmers.reduce((total, farmer) => total + farmer.productionKg, 0)
    });

    if (selectedSubCounty === "All") {
      return MIGORI_SUBCOUNTIES.map((subCounty) =>
        buildRow(
          "Sub-County",
          subCounty,
          "All wards",
          farmers.filter((farmer) => farmer.subCounty === subCounty)
        )
      );
    }

    if (selectedWard !== "All") {
      return [
        buildRow(
          "Ward",
          selectedSubCounty,
          selectedWard,
          farmers.filter((farmer) => farmer.subCounty === selectedSubCounty && farmer.ward === selectedWard)
        )
      ];
    }

    return availableWards.map((ward) =>
      buildRow(
        "Ward",
        selectedSubCounty,
        ward,
        farmers.filter((farmer) => farmer.subCounty === selectedSubCounty && farmer.ward === ward)
      )
    );
  }, [availableWards, farmers, selectedSubCounty, selectedWard]);

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

  const filteredDemographicRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return demographicRows;

    return demographicRows.filter((row) =>
      [
        row.scope,
        row.subCounty,
        row.ward,
        String(row.farmers),
        String(row.male),
        String(row.female),
        String(row.youth),
        String(row.adult),
        String(row.productionKg)
      ].some((value) => value.toLowerCase().includes(term))
    );
  }, [demographicRows, searchTerm]);

  const totalProductionKg = subCountyRows.reduce((total, row) => total + row.productionKg, 0);
  const activeLicenses = filteredLicenses.filter((license) => license.status === "VALID").length;
  const expiredLicenses = filteredLicenses.filter((license) => license.status === "EXPIRED").length;
  const ongoingProjects = filteredProjects.filter((project) => project.status === "ONGOING").length;
  const captureProductionKg = filteredCaptureRecords.reduce((total, record) => total + record.catchKg, 0);

  const licenseRows = useMemo(() => countBy(filteredLicenses, (license) => license.status), [filteredLicenses]);
  const farmerStatusRows = useMemo(() => countBy(filteredFarmers, (farmer) => farmer.status), [filteredFarmers]);
  const genderRows = useMemo(
    () =>
      countBy(filteredFarmers, (farmer) => {
        if (farmer.gender === "MALE") return "Male";
        if (farmer.gender === "FEMALE") return "Female";
        return "Unspecified";
      }),
    [filteredFarmers]
  );
  const ageRows = useMemo(
    () =>
      countBy(filteredFarmers, (farmer) => {
        if (farmer.ageBracket === "YOUTH") return "Youth";
        if (farmer.ageBracket === "ADULT") return "Adult";
        return "Unspecified";
      }),
    [filteredFarmers]
  );
  const projectRows = useMemo(() => countBy(filteredProjects, (project) => project.status), [filteredProjects]);
  const inspectionRows = useMemo(() => countBy(filteredInspections, (inspection) => inspection.result), [filteredInspections]);

  const filteredLicenseRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return licenseRows;

    return licenseRows.filter((row) =>
      [row.name, String(row.value)].some((value) => value.toLowerCase().includes(term))
    );
  }, [licenseRows, searchTerm]);

  const summaryRows = useMemo<SummaryReportRow[]>(() => [
    { metric: "Sub-County Scope", value: selectedSubCounty },
    { metric: "Ward Scope", value: selectedWard },
    { metric: "Total Farmers", value: filteredFarmers.length },
    { metric: "Active Licenses", value: activeLicenses },
    { metric: "Expired Licenses", value: expiredLicenses },
    { metric: "Total Projects", value: filteredProjects.length },
    { metric: "Ongoing Projects", value: ongoingProjects },
    { metric: "Total Production (Kg)", value: totalProductionKg },
    { metric: "Capture Fisheries (Kg)", value: captureProductionKg },
    { metric: "Extension Services", value: filteredInspections.length }
  ], [
    activeLicenses,
    captureProductionKg,
    expiredLicenses,
    filteredFarmers.length,
    filteredInspections.length,
    filteredProjects.length,
    ongoingProjects,
    selectedSubCounty,
    selectedWard,
    totalProductionKg
  ]);

  const licenseStatusExportRows = useMemo(() => toStatusExportRows(licenseRows), [licenseRows]);
  const farmerStatusExportRows = useMemo(() => toStatusExportRows(farmerStatusRows), [farmerStatusRows]);
  const genderExportRows = useMemo(() => toStatusExportRows(genderRows), [genderRows]);
  const ageExportRows = useMemo(() => toStatusExportRows(ageRows), [ageRows]);
  const projectStatusExportRows = useMemo(() => toStatusExportRows(projectRows), [projectRows]);
  const inspectionStatusExportRows = useMemo(() => toStatusExportRows(inspectionRows), [inspectionRows]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading live reports...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reports & Exports</h1>
          <p className="text-sm text-muted-foreground">
            Live operational reports from farmers, licenses, capture fisheries, projects, and extension services.
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
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            value={selectedWard}
            onChange={(event) => setSelectedWard(event.target.value)}
            disabled={selectedSubCounty === "All"}
          >
            <option value="All">{selectedSubCounty === "All" ? "Select sub-county for wards" : "All Wards"}</option>
            {availableWards.map((ward) => (
              <option key={ward} value={ward}>
                {ward}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle>Download Individual Reports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 p-4 pt-2">
          <ExportButton
            filename="report-summary"
            sheetName="Summary"
            columns={summaryExportColumns}
            rows={summaryRows}
            label="Summary"
          />
          <ExportButton
            filename="report-sub-county-performance"
            sheetName="Sub-County Performance"
            columns={subCountyExportColumns}
            rows={subCountyRows}
            label="Sub-County"
          />
          <ExportButton
            filename="report-demographics-drilldown"
            sheetName="Demographics"
            columns={demographicExportColumns}
            rows={demographicRows}
            label="Gender & Age"
          />
          <ExportButton
            filename="report-gender"
            sheetName="Gender"
            columns={statusExportColumns}
            rows={genderExportRows}
            label="Gender"
          />
          <ExportButton
            filename="report-age-bracket"
            sheetName="Age Bracket"
            columns={statusExportColumns}
            rows={ageExportRows}
            label="Youth / Adult"
          />
          <ExportButton
            filename="report-license-status"
            sheetName="License Status"
            columns={statusExportColumns}
            rows={licenseStatusExportRows}
            label="Licenses"
          />
          <ExportButton
            filename="report-farmer-status"
            sheetName="Farmer Status"
            columns={statusExportColumns}
            rows={farmerStatusExportRows}
            label="Farmers"
          />
          <ExportButton
            filename="report-project-status"
            sheetName="Project Status"
            columns={statusExportColumns}
            rows={projectStatusExportRows}
            label="Projects"
          />
          <ExportButton
            filename="report-extension-status"
            sheetName="Extension Status"
            columns={statusExportColumns}
            rows={inspectionStatusExportRows}
            label="Extension"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Farmers" value={filteredFarmers.length} />
        <StatCard label="Total Production" value={formatKg(totalProductionKg)} helper={`${formatNumber(totalProductionKg / 1000, 2)} MT`} />
        <StatCard label="Active Licenses" value={activeLicenses} />
        <StatCard label="Projects" value={filteredProjects.length} helper={`${formatNumber(ongoingProjects)} ongoing`} />
        <StatCard label="Extension Services" value={filteredInspections.length} helper="Current visible scope" />
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

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Farmers by Gender">
          {genderRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={genderRows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={88}
                  label={(entry) =>
                    formatDisplayValue(
                      Number(entry?.value ?? 0),
                      genderRows.reduce((sum, row) => sum + row.value, 0),
                      valueDisplayMode
                    )
                  }
                >
                  {genderRows.map((entry) => (
                    <Cell key={entry.name} fill={entry.name === "Female" ? "#be123c" : entry.name === "Male" ? "#2563eb" : "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No gender records available.</div>
          )}
        </ChartCard>

        <ChartCard title="Farmers by Age Bracket">
          {ageRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageRows} margin={{ left: 0, right: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" name="Farmers" fill="#0f766e" radius={[6, 6, 0, 0]}>
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(value) =>
                      formatDisplayValue(
                        Number(value),
                        ageRows.reduce((sum, row) => sum + row.value, 0),
                        valueDisplayMode
                      )
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No age bracket records available.</div>
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

        <ChartCard title="Extension Status">
          {inspectionRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inspectionRows} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={78} />
                <Tooltip />
                <Bar dataKey="value" name="Extension Services" radius={[0, 6, 6, 0]}>
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
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No extension service records available.</div>
          )}
        </ChartCard>
      </div>

      <div className="space-y-2">
        <div>
          <h2 className="text-base font-semibold">Gender & Age Drill-Down</h2>
          <p className="text-sm text-muted-foreground">
            Switch from all sub-counties to a specific sub-county, then select a ward to narrow the demographic report.
          </p>
        </div>
        <DataTable
          headers={[
            "Scope",
            "Sub-County",
            "Ward",
            "Farmers",
            "Male",
            "Female",
            "Youth",
            "Adult",
            "Unspecified Gender",
            "Unspecified Age",
            "Production"
          ]}
          rows={filteredDemographicRows.map((row) => [
            row.scope,
            row.subCounty,
            row.ward,
            formatNumber(row.farmers),
            formatNumber(row.male),
            formatNumber(row.female),
            formatNumber(row.youth),
            formatNumber(row.adult),
            formatNumber(row.unspecifiedGender),
            formatNumber(row.unspecifiedAge),
            formatKg(row.productionKg)
          ])}
          emptyLabel={getSearchEmptyLabel({
            searchTerm,
            isLoading,
            loadingLabel: "Loading demographic records...",
            emptyLabel: "No demographic records available."
          })}
          pageSize={8}
        />
      </div>

      <DataTable
        headers={["Sub-County", "Farmers", "Production", "Licenses", "Valid Licenses", "Projects", "Extension Services"]}
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
