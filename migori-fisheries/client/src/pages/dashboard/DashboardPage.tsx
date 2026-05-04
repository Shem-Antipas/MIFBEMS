import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFarmers } from "@/hooks/useFarmers";
import { useLicenses } from "@/hooks/useLicenses";
import { reportsApi } from "@/api/reports";
import { projectsApi } from "@/api/projects";
import { useAuthStore } from "@/store/authStore";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import MigoriMap from "@/components/map/MigoriMap";

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const { data: summaryData } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => reportsApi.summary()
  });
  const { data: farmers = [] } = useFarmers();
  const { data: licenses = [] } = useLicenses();
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list
  });

  const farmersBySubCounty = useMemo(() => {
    return farmers.reduce<Record<string, number>>((acc, farmer) => {
      acc[farmer.subCounty] = (acc[farmer.subCounty] ?? 0) + 1;
      return acc;
    }, {});
  }, [farmers]);

  const productionBySubCounty = useMemo(() => {
    return farmers.reduce<Record<string, number>>((acc, farmer) => {
      acc[farmer.subCounty] = (acc[farmer.subCounty] ?? 0) + farmer.productionKg;
      return acc;
    }, {});
  }, [farmers]);

  const licensesBySubCounty = useMemo(() => {
    return licenses.reduce<Record<string, number>>((acc, license) => {
      const subCounty = license.farmer?.subCounty;
      if (!subCounty) return acc;
      acc[subCounty] = (acc[subCounty] ?? 0) + 1;
      return acc;
    }, {});
  }, [licenses]);

  const myFarm = farmers.find((item) => item.id === user?.id);
  const fallbackTotalFarmers = farmers.length;
  const fallbackActiveLicenses = licenses.filter((item) => item.status === "VALID").length;
  const fallbackTotalProductionKg = farmers.reduce((total, item) => total + item.productionKg, 0);
  const fallbackOngoingProjects = projects.filter((item) => item.status === "ONGOING").length;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time view of fisheries operations and blue economy indicators.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Farmers" value={summaryData?.summary.totalFarmers ?? fallbackTotalFarmers} />
        <StatCard label="Active Licenses" value={summaryData?.summary.activeLicenses ?? fallbackActiveLicenses} />
        <StatCard
          label="Total Production (Kg)"
          value={(summaryData?.summary.totalProductionKg ?? fallbackTotalProductionKg).toLocaleString()}
        />
        <StatCard label="Ongoing Projects" value={summaryData?.summary.ongoingProjects ?? fallbackOngoingProjects} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="overflow-hidden rounded-lg border bg-card">
          <img
            src="/images/blue-economy/lake-victoria-fishing-login.jpg"
            alt="Fishing boats and Lake Victoria blue economy activity"
            className="aspect-[16/8] w-full object-cover"
          />
          <div className="p-4">
            <h2 className="text-base font-semibold">Lake Fisheries Operations</h2>
            <p className="mt-1 text-sm text-muted-foreground">BMU activity, licensing, boats, and fisherman records.</p>
          </div>
        </article>
        <article className="overflow-hidden rounded-lg border bg-card">
          <img
            src="/images/blue-economy/small-scale-aquaculture-kenya-card.jpg"
            alt="Aquaculture ponds and cage fish farming"
            className="aspect-[16/8] w-full object-cover"
          />
          <div className="p-4">
            <h2 className="text-base font-semibold">Aquaculture & Data Collection</h2>
            <p className="mt-1 text-sm text-muted-foreground">Production, capture fisheries, and analytics across Migori.</p>
          </div>
        </article>
        <article className="overflow-hidden rounded-lg border bg-card">
          <img
            src="/images/blue-economy/catfish-ponds-kenya-card.jpg"
            alt="Fish ponds supporting aquaculture extension services"
            className="aspect-[16/8] w-full object-cover"
          />
          <div className="p-4">
            <h2 className="text-base font-semibold">Fish Ponds & Extension</h2>
            <p className="mt-1 text-sm text-muted-foreground">Farm status, inspections, production tracking, and officer support.</p>
          </div>
        </article>
      </div>

      <div className="rounded-xl border bg-card p-[18px]">
        <h2 className="mb-3 text-base font-semibold">Migori County Geospatial Insights</h2>
        <MigoriMap
          role={user?.role ?? "DATA_ANALYST"}
          userSubCounty={user?.subCounty}
          farmersBySubCounty={farmersBySubCounty}
          productionBySubCounty={productionBySubCounty}
          licensesBySubCounty={licensesBySubCounty}
          farmerLocation={myFarm?.latitude && myFarm?.longitude ? { lat: myFarm.latitude, lng: myFarm.longitude } : null}
        />
      </div>

      <DataTable
        headers={["Farmer ID", "Farmer", "Sub-County", "Farm Type", "Production (Kg)"]}
        rows={farmers.slice(0, 8).map((farmer) => [
          farmer.farmerCode,
          farmer.name,
          farmer.subCounty,
          farmer.farmType,
          farmer.productionKg.toLocaleString()
        ])}
        emptyLabel="No farmer records available."
      />
    </section>
  );
};

export default DashboardPage;
