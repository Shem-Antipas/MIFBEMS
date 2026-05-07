import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inspectionsApi } from "@/api/inspections";
import { projectsApi } from "@/api/projects";
import { useCaptureFisheries } from "@/hooks/useCaptureFisheries";
import { useFarmers } from "@/hooks/useFarmers";
import { useLicenses } from "@/hooks/useLicenses";
import { useAuthStore } from "@/store/authStore";
import { buildMonthlyCaptureTrend, hasMonthlyCaptureTrendData } from "@/lib/captureAnalytics";
import { formatCurrency, getLicenseRevenue } from "@/lib/licenseRevenue";
import { MIGORI_SUBCOUNTIES, WARDS_BY_SUBCOUNTY, type MigoriSubCounty } from "@/lib/locationData";
import { ALL_YEARS, collectAvailableYears, matchesSelectedYear } from "@/lib/yearFilter";
import type { ExcelColumn } from "@/lib/exportToExcel";

type AnalyticsExportRow = {
  section: string;
  metric: string;
  value: string | number;
};

type NameValueRow = {
  name: string;
  value: number;
};

type ProductionRow = {
  subCounty: string;
  productionKg: number;
  farmers: number;
  licenses: number;
};

type SpeciesRow = {
  species: string;
  quantityKg: number;
  share: number;
};

type WardAnalyticsRow = {
  ward: string;
  productionKg: number;
  farmers: number;
  ponds: number;
};

type RevenueRow = {
  name: string;
  revenue: number;
  licenses: number;
};

const analyticsExportColumns = [
  { header: "Section", value: "section" },
  { header: "Metric", value: "metric" },
  { header: "Value", value: "value" }
] satisfies Array<ExcelColumn<AnalyticsExportRow>>;

const farmTypeLabels: Record<string, string> = {
  POND: "Aquaculture Ponds",
  CAGE: "Cage Culture",
  TANK: "Tank Culture",
  DAM: "Dam Fisheries",
  CAPTURE: "Capture Fisheries"
};

const farmerGenderLabels: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  UNSPECIFIED: "Unspecified"
};

const farmerAgeBracketLabels: Record<string, string> = {
  YOUTH: "Youth - below 35 years",
  ADULT: "Adult - above 35 years",
  UNSPECIFIED: "Unspecified"
};

const chartColors = ["#0f766e", "#2563eb", "#7c3aed", "#ea580c", "#0891b2", "#16a34a", "#ca8a04", "#be123c"];
const statusColors: Record<string, string> = {
  VALID: "#16a34a",
  PENDING: "#ca8a04",
  EXPIRED: "#dc2626",
  REVOKED: "#6b7280",
  REJECTED: "#be123c",
  PLANNED: "#2563eb",
  ONGOING: "#ca8a04",
  COMPLETED: "#16a34a",
  CANCELLED: "#6b7280"
};

const formatNumber = (value: number, maximumFractionDigits = 0): string =>
  value.toLocaleString(undefined, { maximumFractionDigits });

const formatKg = (value: number): string => `${formatNumber(value)} kg`;

const formatTooltipKg = (value: unknown): string => formatKg(Number(value ?? 0));

const getShare = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0);

const formatDisplayValue = (
  value: number,
  total: number,
  mode: "FIGURE" | "PERCENT",
  suffix = ""
): string => (mode === "PERCENT" ? `${formatNumber(getShare(value, total), 1)}%` : `${formatNumber(value)}${suffix}`);

const ChartCard = ({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) => (
  <Card className={className}>
    <CardHeader className="p-4 pb-2">
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="h-72 p-4 pt-2">{children}</CardContent>
  </Card>
);

const AnalyticsPage = () => {
  const [selectedSubCounty, setSelectedSubCounty] = useState<string>("All");
  const [selectedWard, setSelectedWard] = useState<string>("All");
  const [selectedYear, setSelectedYear] = useState<string>(ALL_YEARS);
  const [valueDisplayMode, setValueDisplayMode] = useState<"FIGURE" | "PERCENT">("FIGURE");
  const user = useAuthStore((state) => state.user);
  const isOfficer = user?.role === "FISHERIES_OFFICER";
  const officerSubCounty =
    user?.subCounty && MIGORI_SUBCOUNTIES.includes(user.subCounty as MigoriSubCounty)
      ? user.subCounty
      : undefined;
  const selectedScopeSubCounty = isOfficer ? officerSubCounty ?? "All" : selectedSubCounty;
  const availableAnalyticsWards =
    selectedScopeSubCounty !== "All" && MIGORI_SUBCOUNTIES.includes(selectedScopeSubCounty as MigoriSubCounty)
      ? WARDS_BY_SUBCOUNTY[selectedScopeSubCounty as MigoriSubCounty]
      : [];
  const { data: farmers = [] } = useFarmers();
  const { data: licenses = [] } = useLicenses();
  const { data: captureRecords = [] } = useCaptureFisheries();
  const { data: extensionEntries = [] } = useQuery({
    queryKey: ["inspections"],
    queryFn: inspectionsApi.list
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list
  });

  const availableYears = useMemo(
    () =>
      collectAvailableYears(
        farmers.map((farmer) => farmer.createdAt),
        licenses.map((license) => license.issuedDate),
        captureRecords.map((record) => record.year ?? record.fishingDate),
        extensionEntries.map((entry) => entry.date),
        projects.map((project) => project.startDate)
      ),
    [captureRecords, extensionEntries, farmers, licenses, projects]
  );
  const getLicenseSubCounty = (license: (typeof licenses)[number]): string =>
    license.subCounty ?? license.farmer?.subCounty ?? "";
  const getLicenseWard = (license: (typeof licenses)[number]): string =>
    license.ward ?? license.farmer?.ward ?? "";
  const matchesSelectedSubCounty = (subCounty: string): boolean =>
    selectedScopeSubCounty === "All" || subCounty === selectedScopeSubCounty;
  const matchesSelectedWard = (ward?: string | null): boolean =>
    selectedWard === "All" || ward === selectedWard || ward === "All wards";

  const yearFilteredFarmers = useMemo(
    () => farmers.filter((farmer) => matchesSelectedYear(selectedYear, farmer.createdAt)),
    [farmers, selectedYear]
  );

  const yearFilteredLicenses = useMemo(
    () => licenses.filter((license) => matchesSelectedYear(selectedYear, license.issuedDate)),
    [licenses, selectedYear]
  );

  const yearFilteredCaptureRecords = useMemo(
    () => captureRecords.filter((record) => matchesSelectedYear(selectedYear, record.year ?? record.fishingDate)),
    [captureRecords, selectedYear]
  );

  const yearFilteredProjects = useMemo(
    () => projects.filter((project) => matchesSelectedYear(selectedYear, project.startDate)),
    [projects, selectedYear]
  );

  const yearFilteredExtensionEntries = useMemo(
    () => extensionEntries.filter((entry) => matchesSelectedYear(selectedYear, entry.date)),
    [extensionEntries, selectedYear]
  );

  const filteredFarmers = useMemo(
    () =>
      selectedScopeSubCounty === "All"
        ? yearFilteredFarmers
        : yearFilteredFarmers.filter((farmer) => farmer.subCounty === selectedScopeSubCounty && matchesSelectedWard(farmer.ward)),
    [selectedScopeSubCounty, selectedWard, yearFilteredFarmers]
  );

  const filteredLicenses = useMemo(
    () =>
      selectedScopeSubCounty === "All"
        ? yearFilteredLicenses
        : yearFilteredLicenses.filter((license) => matchesSelectedSubCounty(getLicenseSubCounty(license)) && matchesSelectedWard(getLicenseWard(license))),
    [selectedScopeSubCounty, selectedWard, yearFilteredLicenses]
  );

  const filteredCaptureRecords = useMemo(
    () =>
      selectedScopeSubCounty === "All"
        ? yearFilteredCaptureRecords
        : yearFilteredCaptureRecords.filter((record) => record.subCounty === selectedScopeSubCounty && matchesSelectedWard(record.ward)),
    [selectedScopeSubCounty, selectedWard, yearFilteredCaptureRecords]
  );

  const filteredProjects = useMemo(
    () =>
      selectedScopeSubCounty === "All"
        ? yearFilteredProjects
        : yearFilteredProjects.filter((project) => project.subCounty === selectedScopeSubCounty && matchesSelectedWard(project.ward)),
    [selectedScopeSubCounty, selectedWard, yearFilteredProjects]
  );

  const filteredExtensionEntries = useMemo(
    () =>
      selectedScopeSubCounty === "All"
        ? yearFilteredExtensionEntries
        : yearFilteredExtensionEntries.filter((entry) => entry.subCounty === selectedScopeSubCounty && matchesSelectedWard(entry.ward)),
    [selectedScopeSubCounty, selectedWard, yearFilteredExtensionEntries]
  );

  const farmProductionKg = useMemo(
    () => filteredFarmers.reduce((total, farmer) => total + farmer.productionKg, 0),
    [filteredFarmers]
  );

  const captureProductionKg = useMemo(
    () => filteredCaptureRecords.reduce((total, record) => total + record.catchKg, 0),
    [filteredCaptureRecords]
  );

  const captureMonthlyRows = useMemo(() => buildMonthlyCaptureTrend(filteredCaptureRecords), [filteredCaptureRecords]);

  const totalProductionKg = farmProductionKg + captureProductionKg;

  const subCountyRows = useMemo<ProductionRow[]>(() => {
    return MIGORI_SUBCOUNTIES.map((subCounty) => {
      const farmersInSubCounty = yearFilteredFarmers.filter((farmer) => farmer.subCounty === subCounty);
      const licensesInSubCounty = yearFilteredLicenses.filter((license) => getLicenseSubCounty(license) === subCounty);
      const farmProduction = farmersInSubCounty.reduce((total, farmer) => total + farmer.productionKg, 0);
      const captureProduction = yearFilteredCaptureRecords
        .filter((record) => record.subCounty === subCounty)
        .reduce((total, record) => total + record.catchKg, 0);

      return {
        subCounty,
        productionKg: farmProduction + captureProduction,
        farmers: farmersInSubCounty.length,
        licenses: licensesInSubCounty.length
      };
    });
  }, [yearFilteredCaptureRecords, yearFilteredFarmers, yearFilteredLicenses]);

  const extensionSummaryRows = useMemo<NameValueRow[]>(() => {
    return MIGORI_SUBCOUNTIES.map((subCounty) => ({
      name: subCounty,
      value: yearFilteredExtensionEntries.filter((entry) => entry.subCounty === subCounty).length
    })).filter((item) => selectedScopeSubCounty === "All" || item.name === selectedScopeSubCounty);
  }, [selectedScopeSubCounty, yearFilteredExtensionEntries]);

  const visibleSubCountyRows = selectedScopeSubCounty === "All"
    ? subCountyRows
    : subCountyRows.filter((row) => row.subCounty === selectedScopeSubCounty);
  const isSubCountyDrilldown = selectedScopeSubCounty !== "All";
  const activeSubCountyRow = subCountyRows.find((row) => row.subCounty === selectedScopeSubCounty);
  const drilldownRows = isSubCountyDrilldown ? visibleSubCountyRows : subCountyRows;

  const farmTypeRows = useMemo<NameValueRow[]>(() => {
    const totals = filteredFarmers.reduce<Record<string, number>>((acc, farmer) => {
      const label = farmTypeLabels[farmer.farmType] ?? farmer.farmType;
      acc[label] = (acc[label] ?? 0) + farmer.productionKg;
      return acc;
    }, {});

    if (captureProductionKg > 0) {
      totals[farmTypeLabels.CAPTURE] = captureProductionKg;
    }

    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [captureProductionKg, filteredFarmers]);

  const speciesRows = useMemo<SpeciesRow[]>(() => {
    const speciesTotals = new Map<string, number>();

    filteredFarmers.forEach((farmer) => {
      const species = farmer.species.length > 0 ? farmer.species : ["Unspecified"];
      const apportionedProduction = species.length > 0 ? farmer.productionKg / species.length : farmer.productionKg;

      species.forEach((item) => {
        const name = item.trim() || "Unspecified";
        speciesTotals.set(name, (speciesTotals.get(name) ?? 0) + apportionedProduction);
      });
    });

    filteredCaptureRecords.forEach((record) => {
      const name = record.species.trim() || "Unspecified";
      speciesTotals.set(name, (speciesTotals.get(name) ?? 0) + record.catchKg);
    });

    const rows = Array.from(speciesTotals.entries())
      .map(([species, quantityKg]) => ({
        species,
        quantityKg,
        share: getShare(quantityKg, totalProductionKg)
      }))
      .sort((a, b) => b.quantityKg - a.quantityKg);

    const topRows = rows.slice(0, 6);
    const otherQuantity = rows.slice(6).reduce((total, row) => total + row.quantityKg, 0);

    return otherQuantity > 0
      ? [...topRows, { species: "Others", quantityKg: otherQuantity, share: getShare(otherQuantity, totalProductionKg) }]
      : topRows;
  }, [filteredCaptureRecords, filteredFarmers, totalProductionKg]);

  const licenseStatusRows = useMemo<NameValueRow[]>(() => {
    const totals = filteredLicenses.reduce<Record<string, number>>((acc, license) => {
      acc[license.status] = (acc[license.status] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [filteredLicenses]);

  const projectStatusRows = useMemo<NameValueRow[]>(() => {
    const totals = filteredProjects.reduce<Record<string, number>>((acc, project) => {
      acc[project.status] = (acc[project.status] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [filteredProjects]);

  const farmerStatusRows = useMemo<NameValueRow[]>(() => {
    const totals = filteredFarmers.reduce<Record<string, number>>((acc, farmer) => {
      acc[farmer.status] = (acc[farmer.status] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [filteredFarmers]);

  const farmerGenderRows = useMemo<NameValueRow[]>(() => {
    const totals = filteredFarmers.reduce<Record<string, number>>((acc, farmer) => {
      const key = farmer.gender ?? "UNSPECIFIED";
      const label = farmerGenderLabels[key] ?? key;
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [filteredFarmers]);

  const farmerAgeBracketRows = useMemo<NameValueRow[]>(() => {
    const totals = filteredFarmers.reduce<Record<string, number>>((acc, farmer) => {
      const key = farmer.ageBracket ?? "UNSPECIFIED";
      const label = farmerAgeBracketLabels[key] ?? key;
      acc[label] = (acc[label] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [filteredFarmers]);

  const wardRows = useMemo<WardAnalyticsRow[]>(() => {
    if (!isSubCountyDrilldown) return [];

    const rows = filteredFarmers.reduce<Record<string, WardAnalyticsRow>>((acc, farmer) => {
      const ward = farmer.ward || "Unspecified";
      const current = acc[ward] ?? {
        ward,
        productionKg: 0,
        farmers: 0,
        ponds: 0
      };

      current.productionKg += farmer.productionKg;
      current.farmers += 1;
      current.ponds += farmer.farmType === "POND" ? farmer.numberOfPonds : 0;
      acc[ward] = current;
      return acc;
    }, {});

    return Object.values(rows).sort((a, b) => b.productionKg - a.productionKg);
  }, [filteredFarmers, isSubCountyDrilldown]);

  const pondStats = useMemo(() => {
    const pondFarmers = filteredFarmers.filter((farmer) => farmer.farmType === "POND");
    const numberOfPonds = pondFarmers.reduce((total, farmer) => total + farmer.numberOfPonds, 0);
    const activePonds = pondFarmers.reduce((total, farmer) => total + farmer.activePonds, 0);
    const inactivePonds = pondFarmers.reduce((total, farmer) => total + farmer.inactivePonds, 0);

    return {
      farms: pondFarmers.length,
      numberOfPonds,
      activePonds,
      inactivePonds,
      activeRate: getShare(activePonds, numberOfPonds)
    };
  }, [filteredFarmers]);

  const operatingUnits = pondStats.activePonds + filteredFarmers.filter((farmer) => farmer.farmType !== "POND").length;
  const averageProductionPerFarmer = filteredFarmers.length > 0 ? totalProductionKg / filteredFarmers.length : 0;
  const validLicenseCount = filteredLicenses.filter((license) => license.status === "VALID").length;
  const totalLicenseRevenue = filteredLicenses.reduce((total, license) => total + getLicenseRevenue(license), 0);
  const revenueRows = useMemo<RevenueRow[]>(() => {
    if (selectedScopeSubCounty !== "All" && MIGORI_SUBCOUNTIES.includes(selectedScopeSubCounty as MigoriSubCounty)) {
      return WARDS_BY_SUBCOUNTY[selectedScopeSubCounty as MigoriSubCounty]
        .filter((ward) => selectedWard === "All" || ward === selectedWard)
        .map((ward) => {
          const wardLicenses = filteredLicenses.filter((license) => getLicenseWard(license) === ward);
          return {
            name: ward,
            revenue: wardLicenses.reduce((total, license) => total + getLicenseRevenue(license), 0),
            licenses: wardLicenses.filter((license) => license.status === "VALID").length
          };
        })
        .filter((row) => row.revenue > 0 || row.licenses > 0);
    }

    return MIGORI_SUBCOUNTIES.map((subCounty) => {
      const subCountyLicenses = filteredLicenses.filter((license) => getLicenseSubCounty(license) === subCounty);
      return {
        name: subCounty,
        revenue: subCountyLicenses.reduce((total, license) => total + getLicenseRevenue(license), 0),
        licenses: subCountyLicenses.filter((license) => license.status === "VALID").length
      };
    }).filter((row) => row.revenue > 0 || row.licenses > 0);
  }, [filteredLicenses, selectedScopeSubCounty, selectedWard]);
  const completedProjectCount = filteredProjects.filter((project) => project.status === "COMPLETED").length;
  const topSubCounty = [...subCountyRows].sort((a, b) => b.productionKg - a.productionKg)[0];
  const topSpecies = speciesRows[0];
  const subCountyProductionInsight = isSubCountyDrilldown && activeSubCountyRow
    ? `${activeSubCountyRow.subCounty} recorded ${formatKg(activeSubCountyRow.productionKg)}, with ${formatNumber(activeSubCountyRow.farmers)} farmers and ${formatNumber(activeSubCountyRow.licenses)} licenses.`
    : topSubCounty && topSubCounty.productionKg > 0
      ? `${topSubCounty.subCounty} has the highest recorded production at ${formatKg(topSubCounty.productionKg)}.`
      : "Production records are not yet available for comparison.";

  const insightRows = [
    subCountyProductionInsight,
    `${farmTypeLabels.CAPTURE} contributes ${formatNumber(getShare(captureProductionKg, totalProductionKg), 1)}% of visible production.`,
    `Pond utilization is ${formatNumber(pondStats.activeRate, 1)}% active across ${formatNumber(pondStats.numberOfPonds)} registered ponds.`,
    topSpecies
      ? `${topSpecies.species} leads species records with ${formatNumber(topSpecies.share, 1)}% share.`
      : "Species distribution will appear once production records include species data.",
    `${formatNumber(validLicenseCount)} valid licenses are visible in the current scope.`,
    `${formatCurrency(totalLicenseRevenue)} in approved license revenue is visible in the current scope.`
  ];

  const exportRows = useMemo<AnalyticsExportRow[]>(() => {
    return [
      {
        section: "Scope",
        metric: "Year",
        value: selectedYear === ALL_YEARS ? "All Years" : selectedYear
      },
      ...visibleSubCountyRows.map((row) => ({
        section: "Production by Sub-County",
        metric: row.subCounty,
        value: Math.round(row.productionKg)
      })),
      ...farmTypeRows.map((row) => ({
        section: "Production by Sub-Sector",
        metric: row.name,
        value: Math.round(row.value)
      })),
      ...captureMonthlyRows.map((row) => ({
        section: "Capture Fisheries Monthly Trend",
        metric: row.month,
        value: `${formatKg(row.quantityKg)} - ${formatCurrency(row.value)} - ${formatNumber(row.records)} records`
      })),
      ...speciesRows.map((row) => ({
        section: "Species Share",
        metric: row.species,
        value: `${formatNumber(row.quantityKg)} kg (${formatNumber(row.share, 1)}%)`
      })),
      ...licenseStatusRows.map((row) => ({
        section: "License Status",
        metric: row.name,
        value: row.value
      })),
      ...revenueRows.map((row) => ({
        section: "License Revenue",
        metric: row.name,
        value: `${formatCurrency(row.revenue)} (${formatNumber(row.licenses)} valid licenses)`
      })),
      ...projectStatusRows.map((row) => ({
        section: "Project Status",
        metric: row.name,
        value: row.value
      })),
      ...farmerStatusRows.map((row) => ({
        section: "Farmer Status",
        metric: row.name,
        value: row.value
      })),
      ...farmerGenderRows.map((row) => ({
        section: "Farmer Gender Distribution",
        metric: row.name,
        value: row.value
      })),
      ...farmerAgeBracketRows.map((row) => ({
        section: "Farmer Age Distribution",
        metric: row.name,
        value: row.value
      })),
      ...wardRows.map((row) => ({
        section: "Ward Drill Down",
        metric: row.ward,
        value: `${formatNumber(row.productionKg)} kg, ${formatNumber(row.farmers)} farmers`
      })),
      ...extensionSummaryRows.map((row) => ({
        section: "Extension Summary",
        metric: row.name,
        value: row.value
      }))
    ];
  }, [
    extensionSummaryRows,
    captureMonthlyRows,
    farmTypeRows,
    farmerAgeBracketRows,
    farmerGenderRows,
    farmerStatusRows,
    licenseStatusRows,
    projectStatusRows,
    revenueRows,
    selectedYear,
    speciesRows,
    visibleSubCountyRows,
    wardRows
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Fisheries production, licensing, infrastructure, and species distribution across MiFBeDAS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
          >
            <option value={ALL_YEARS}>All Years</option>
            {availableYears.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
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
            value={selectedScopeSubCounty}
            onChange={(event) => {
              setSelectedSubCounty(event.target.value);
              setSelectedWard("All");
            }}
            disabled={isOfficer}
          >
            <option value="All">All Sub-Counties</option>
            {(isOfficer && officerSubCounty ? [officerSubCounty] : MIGORI_SUBCOUNTIES).map((subCounty) => (
              <option key={subCounty} value={subCounty}>
                {subCounty}
              </option>
            ))}
          </select>
          {selectedScopeSubCounty !== "All" ? (
            <select
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedWard}
              onChange={(event) => setSelectedWard(event.target.value)}
            >
              <option value="All">All Wards</option>
              {availableAnalyticsWards.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          ) : null}
          <ExportButton
            filename="analytics-distribution"
            sheetName="Analytics"
            columns={analyticsExportColumns}
            rows={exportRows}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7">
        <StatCard label="Total Fish Production" value={formatKg(totalProductionKg)} helper={`${formatNumber(totalProductionKg / 1000, 2)} MT`} />
        <StatCard label="Capture Fisheries" value={formatKg(captureProductionKg)} helper="Nyatike capture data" />
        <StatCard label="Fish Farmers" value={formatNumber(filteredFarmers.length)} helper={`${formatNumber(pondStats.farms)} pond farms`} />
        <StatCard label="Operating Units" value={formatNumber(operatingUnits)} helper="Active ponds plus non-pond farms" />
        <StatCard label="Average Production/Farmer" value={formatKg(averageProductionPerFarmer)} helper={`${formatNumber(validLicenseCount)} valid licenses`} />
        <StatCard label="License Revenue" value={formatCurrency(totalLicenseRevenue)} helper="Approved license fees" />
        <StatCard label="Extension Entries" value={formatNumber(filteredExtensionEntries.length)} helper="Services captured" />
      </div>

      <ChartCard title="Capture Fisheries Monthly Trend">
        {hasMonthlyCaptureTrendData(captureMonthlyRows) ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={captureMonthlyRows} margin={{ left: 0, right: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis yAxisId="quantity" fontSize={11} tickFormatter={(value: number) => formatNumber(value / 1000, 1)} />
              <YAxis
                yAxisId="revenue"
                orientation="right"
                fontSize={11}
                tickFormatter={(value: number) => formatNumber(value / 1000, 0)}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === "Revenue" ? formatCurrency(Number(value ?? 0)) : formatTooltipKg(value)
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="quantity"
                type="monotone"
                dataKey="quantityKg"
                name="Quantity"
                stroke="#2563eb"
                fill="#bfdbfe"
                strokeWidth={2}
              />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="value"
                name="Revenue"
                stroke="#16a34a"
                fill="#bbf7d0"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            No capture fisheries monthly data available in the selected scope.
          </div>
        )}
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Farmers by Gender">
          {farmerGenderRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={farmerGenderRows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={88}
                  paddingAngle={2}
                  label={(entry) =>
                    formatDisplayValue(
                      Number(entry?.value ?? 0),
                      farmerGenderRows.reduce((sum, row) => sum + row.value, 0),
                      valueDisplayMode
                    )
                  }
                >
                  {farmerGenderRows.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No gender data available.</div>
          )}
        </ChartCard>

        <ChartCard title="Farmers by Age Bracket">
          {farmerAgeBracketRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={farmerAgeBracketRows} layout="vertical" margin={{ left: 56, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={136} />
                <Tooltip />
                <Bar dataKey="value" name="Farmers" radius={[0, 6, 6, 0]} fill="#0891b2">
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value) =>
                      formatDisplayValue(
                        Number(value),
                        farmerAgeBracketRows.reduce((sum, row) => sum + row.value, 0),
                        valueDisplayMode
                      )
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No age bracket data available.</div>
          )}
        </ChartCard>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 p-4 pb-2">
          <div>
            <CardTitle>{isSubCountyDrilldown ? `${selectedScopeSubCounty} Drill Down` : "Sub-County Drill Down"}</CardTitle>
            {isSubCountyDrilldown ? (
              <p className="mt-1 text-sm text-muted-foreground">
                This view is scoped to {selectedScopeSubCounty}{selectedWard !== "All" ? ` / ${selectedWard}` : ""}; other sub-county analytics are hidden.
              </p>
            ) : null}
          </div>
          {isSubCountyDrilldown && !isOfficer ? (
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
              onClick={() => {
                setSelectedSubCounty("All");
                setSelectedWard("All");
              }}
            >
              County View
            </button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 p-4 pt-2 sm:grid-cols-2 xl:grid-cols-4">
          {drilldownRows.map((row) => {
            const isActive = selectedScopeSubCounty === row.subCounty;
            return (
              <button
                key={row.subCounty}
                type="button"
                aria-pressed={isActive}
                className={`rounded-lg border p-3 text-left transition hover:border-primary hover:bg-primary/5 ${
                  isActive ? "border-primary bg-primary/10" : "bg-secondary/20"
                }`}
                onClick={() => {
                  if (!isOfficer) {
                    setSelectedSubCounty(row.subCounty);
                    setSelectedWard("All");
                  }
                }}
              >
                <span className="text-sm font-semibold">{row.subCounty}</span>
                <span className="mt-2 block text-lg font-semibold">{formatKg(row.productionKg)}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatNumber(row.farmers)} farmers - {formatNumber(row.licenses)} licenses
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {isSubCountyDrilldown ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <ChartCard title={`${selectedScopeSubCounty} Ward Production`}>
            {wardRows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wardRows} margin={{ left: 0, right: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ward" fontSize={11} interval={0} angle={-24} textAnchor="end" height={72} />
                  <YAxis fontSize={11} tickFormatter={(value: number) => formatNumber(value / 1000, 1)} />
                  <Tooltip formatter={formatTooltipKg} />
                  <Bar dataKey="productionKg" name="Production" radius={[6, 6, 0, 0]} fill="#2563eb">
                    <LabelList
                      dataKey="productionKg"
                      position="top"
                      formatter={(value) =>
                        formatDisplayValue(
                          Number(value),
                          wardRows.reduce((sum, row) => sum + row.productionKg, 0),
                          valueDisplayMode
                        )
                      }
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No ward records available.</div>
            )}
          </ChartCard>

          <ChartCard title={`${selectedScopeSubCounty} Farmer Status`}>
            {farmerStatusRows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={farmerStatusRows}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={86}
                    label={(entry) =>
                      formatDisplayValue(
                        Number(entry?.value ?? 0),
                        farmerStatusRows.reduce((sum, row) => sum + row.value, 0),
                        valueDisplayMode
                      )
                    }
                  >
                    {farmerStatusRows.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">No farmer status data available.</div>
            )}
          </ChartCard>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <ChartCard title="Production by Sub-County">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleSubCountyRows} margin={{ left: 0, right: 8, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="subCounty" fontSize={11} interval={0} angle={-20} textAnchor="end" height={56} />
              <YAxis fontSize={11} tickFormatter={(value: number) => formatNumber(value / 1000, 1)} />
              <Tooltip formatter={formatTooltipKg} />
              <Bar dataKey="productionKg" name="Production" radius={[6, 6, 0, 0]} fill="#0f766e">
                <LabelList
                  dataKey="productionKg"
                  position="top"
                  formatter={(value) =>
                    formatDisplayValue(
                      Number(value),
                      visibleSubCountyRows.reduce((sum, row) => sum + row.productionKg, 0),
                      valueDisplayMode
                    )
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Production by Sub-Sector">
          {farmTypeRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={farmTypeRows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  label={(entry) =>
                    formatDisplayValue(
                      Number(entry?.value ?? 0),
                      farmTypeRows.reduce((sum, row) => sum + row.value, 0),
                      valueDisplayMode,
                      valueDisplayMode === "FIGURE" ? " kg" : ""
                    )
                  }
                >
                  {farmTypeRows.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipKg} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No production data available.</div>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Species Share by Weight">
          {speciesRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={speciesRows}
                  dataKey="quantityKg"
                  nameKey="species"
                  outerRadius={86}
                  label={(entry) =>
                    formatDisplayValue(Number(entry?.value ?? 0), totalProductionKg, valueDisplayMode, valueDisplayMode === "FIGURE" ? " kg" : "")
                  }
                >
                  {speciesRows.map((entry, index) => (
                    <Cell key={entry.species} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipKg} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No species data available.</div>
          )}
        </ChartCard>

        <ChartCard title="License Status Distribution">
          {licenseStatusRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={licenseStatusRows} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="name" fontSize={11} width={72} />
                <Tooltip />
                <Bar dataKey="value" name="Licenses" radius={[0, 6, 6, 0]}>
                  {licenseStatusRows.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] ?? "#0f766e"} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    formatter={(value) =>
                      formatDisplayValue(
                        Number(value),
                        licenseStatusRows.reduce((sum, row) => sum + row.value, 0),
                        valueDisplayMode
                      )
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No license data available.</div>
          )}
        </ChartCard>

        <ChartCard title={selectedScopeSubCounty === "All" ? "License Revenue by Sub-County" : "License Revenue by Ward"}>
          {revenueRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueRows} layout="vertical" margin={{ left: 28, right: 32 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} tickFormatter={(value: number) => formatNumber(value / 1000, 0)} />
                <YAxis type="category" dataKey="name" fontSize={11} width={112} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]} fill="#16a34a">
                  <LabelList dataKey="revenue" position="right" formatter={(value) => formatCurrency(Number(value ?? 0))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No approved license revenue available.</div>
          )}
        </ChartCard>

        <ChartCard title="Project Status">
          {projectStatusRows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={projectStatusRows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={86}
                  label={(entry) =>
                    formatDisplayValue(
                      Number(entry?.value ?? 0),
                      projectStatusRows.reduce((sum, row) => sum + row.value, 0),
                      valueDisplayMode
                    )
                  }
                >
                  {projectStatusRows.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] ?? "#2563eb"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">No project data available.</div>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Extension Summaries by Sub-County">
        {extensionSummaryRows.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={extensionSummaryRows} margin={{ left: 0, right: 8, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={11} interval={0} angle={-18} textAnchor="end" height={58} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Extension Entries" radius={[6, 6, 0, 0]} fill="#0ea5e9">
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value) =>
                    formatDisplayValue(
                      Number(value),
                      extensionSummaryRows.reduce((sum, row) => sum + row.value, 0),
                      valueDisplayMode
                    )
                  }
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            No extension entries available.
          </div>
        )}
      </ChartCard>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1.15fr]">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle>Pond Infrastructure</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-2 sm:grid-cols-2">
            {[
              ["Registered Ponds", formatNumber(pondStats.numberOfPonds)],
              ["Active Ponds", formatNumber(pondStats.activePonds)],
              ["Inactive Ponds", formatNumber(pondStats.inactivePonds)],
              ["Active Rate", `${formatNumber(pondStats.activeRate, 1)}%`]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <ChartCard title="Production Mix Trend">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={[
                { name: "Farm", value: farmProductionKg },
                { name: "Capture", value: captureProductionKg },
                { name: "Total", value: totalProductionKg }
              ]}
              margin={{ left: 0, right: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(value: number) => formatNumber(value / 1000, 1)} />
              <Tooltip formatter={formatTooltipKg} />
              <Area type="monotone" dataKey="value" name="Production" stroke="#0f766e" fill="#99f6e4">
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(value) =>
                    formatDisplayValue(
                      Number(value),
                      farmProductionKg + captureProductionKg + totalProductionKg,
                      valueDisplayMode,
                      valueDisplayMode === "FIGURE" ? " kg" : ""
                    )
                  }
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-2 text-sm">
            {insightRows.map((insight) => (
              <div key={insight} className="flex gap-2 rounded-lg border bg-secondary/20 p-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <p>{insight}</p>
              </div>
            ))}
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              Completed projects: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatNumber(completedProjectCount)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle>Top Species by Weight</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-4 pt-2">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Species</th>
                <th className="py-2 text-right">Quantity</th>
                <th className="py-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {speciesRows.map((row) => (
                <tr key={row.species} className="border-b last:border-0">
                  <td className="py-2 font-medium">{row.species}</td>
                  <td className="py-2 text-right">{formatKg(row.quantityKg)}</td>
                  <td className="py-2 text-right">{formatNumber(row.share, 1)}%</td>
                </tr>
              ))}
              {speciesRows.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-muted-foreground" colSpan={3}>
                    No species records available.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
};

export default AnalyticsPage;
