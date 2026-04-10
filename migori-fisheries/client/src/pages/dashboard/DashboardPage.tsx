import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFarmers } from "@/hooks/useFarmers";
import { useLicenses } from "@/hooks/useLicenses";
import { reportsApi } from "@/api/reports";
import { useAuthStore } from "@/store/authStore";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import MigoriMap from "@/components/map/MigoriMap";

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const { data: summaryData } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: reportsApi.summary
  });
  const { data: farmers = [] } = useFarmers();
  const { data: licenses = [] } = useLicenses();

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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time view of fisheries operations and blue economy indicators.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Farmers" value={summaryData?.summary.totalFarmers ?? 0} />
        <StatCard label="Active Licenses" value={summaryData?.summary.activeLicenses ?? 0} />
        <StatCard label="Total Production (Kg)" value={(summaryData?.summary.totalProductionKg ?? 0).toLocaleString()} />
        <StatCard label="Ongoing Projects" value={summaryData?.summary.ongoingProjects ?? 0} />
      </div>

      <div className="rounded-xl border bg-white p-[18px]">
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
        headers={["Farmer", "Sub-County", "Farm Type", "Production (Kg)"]}
        rows={farmers.slice(0, 8).map((farmer) => [
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
