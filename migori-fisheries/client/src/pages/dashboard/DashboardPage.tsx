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
  const fallbackCompletedProjects = projects.filter((item) => item.status === "COMPLETED").length;
  const fallbackProjectCost = projects.reduce((total, item) => total + item.budget, 0);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time view of fisheries operations and blue economy indicators.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Farmers" value={summaryData?.summary.totalFarmers ?? fallbackTotalFarmers} />
        <StatCard label="Active Licenses" value={summaryData?.summary.activeLicenses ?? fallbackActiveLicenses} />
        <StatCard
          label="Total Production (Kg)"
          value={(summaryData?.summary.totalProductionKg ?? fallbackTotalProductionKg).toLocaleString()}
        />
        <StatCard label="Completed Projects" value={fallbackCompletedProjects} />
        <StatCard label="Project Cost (KES)" value={fallbackProjectCost.toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="overflow-hidden rounded-lg border bg-card">
          <img
            src="/images/blue-economy/lake-victoria-fishing-login.jpg"
            alt="Fishing boats and Lake Victoria blue economy activity"
            className="aspect-[16/8] w-full object-cover"
          />
          <div className="p-4">
            <h2 className="text-base font-semibold">Lakefront Fisheries Development</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sustainable capture fisheries management along Lake Victoria shorelines.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Landing site development and rehabilitation</li>
              <li>Fisheries regulation enforcement with BMUs</li>
              <li>Fish quality assurance and post-harvest handling</li>
              <li>Fish stock and ecosystem health monitoring</li>
              <li>Fisher livelihood support and value addition</li>
            </ul>
          </div>
        </article>
        <article className="overflow-hidden rounded-lg border bg-card">
          <img
            src="/images/blue-economy/small-scale-aquaculture-kenya-card.jpg"
            alt="Aquaculture ponds and cage fish farming"
            className="aspect-[16/8] w-full object-cover"
          />
          <div className="p-4">
            <h2 className="text-base font-semibold">Blue Economy</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sustainable aquatic resource use for growth, jobs, and conservation.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Water transport and logistics development</li>
              <li>Ecotourism and recreation promotion</li>
              <li>Aquatic ecosystem and biodiversity conservation</li>
              <li>Climate-resilient resource utilization</li>
              <li>Innovation and blue value-chain investment</li>
            </ul>
          </div>
        </article>
        <article className="overflow-hidden rounded-lg border bg-card">
          <img
            src="/images/blue-economy/catfish-ponds-kenya-card.jpg"
            alt="Fish ponds supporting aquaculture extension services"
            className="aspect-[16/8] w-full object-cover"
          />
          <div className="p-4">
            <h2 className="text-base font-semibold">Aquaculture Development</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Expansion of fish farming for food security, incomes, and climate resilience.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Fish pond and cage culture development</li>
              <li>Farmer training and capacity building</li>
              <li>Fingerling production and distribution</li>
              <li>Feed production and nutrition management</li>
              <li>Aquaculture data systems and production monitoring</li>
            </ul>
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
