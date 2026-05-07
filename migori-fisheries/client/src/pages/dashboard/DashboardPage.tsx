import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFarmers } from "@/hooks/useFarmers";
import { useLicenses } from "@/hooks/useLicenses";
import { useCaptureFisheries } from "@/hooks/useCaptureFisheries";
import { reportsApi } from "@/api/reports";
import { projectsApi } from "@/api/projects";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency, getLicenseRevenue } from "@/lib/licenseRevenue";
import StatCard from "@/components/shared/StatCard";
import DataTable from "@/components/shared/DataTable";
import MigoriMap from "@/components/map/MigoriMap";

const featureCards = [
  {
    title: "Lakefront Fisheries Development",
    description: "Sustainable capture fisheries management along Lake Victoria shorelines.",
    imageSrc: "/images/blue-economy/lakefront-fisheries-development.jpg.jpeg",
    fallbackSrc: "/images/blue-economy/lake-victoria-fishing-login.jpg",
    alt: "Lakefront cage fisheries development on Lake Victoria",
    points: [
      "Landing site development and rehabilitation",
      "Fisheries regulation enforcement with BMUs",
      "Fish quality assurance and post-harvest handling",
      "Fish stock and ecosystem health monitoring",
      "Fisher livelihood support and value addition"
    ]
  },
  {
    title: "Blue Economy",
    description: "Sustainable aquatic resource use for growth, jobs, and conservation.",
    imageSrc: "/images/blue-economy/dashboard-blue-economy.jpg.jpeg",
    fallbackSrc: "/images/blue-economy/small-scale-aquaculture-kenya-card.jpg",
    alt: "Blue economy vessel moving across Lake Victoria",
    points: [
      "Water transport and logistics development",
      "Ecotourism and recreation promotion",
      "Aquatic ecosystem and biodiversity conservation",
      "Climate-resilient resource utilization",
      "Innovation and blue value-chain investment"
    ]
  },
  {
    title: "Aquaculture Development",
    description: "Expansion of fish farming for food security, incomes, and climate resilience.",
    imageSrc: "/images/blue-economy/aquaculture-development.jpg.jpeg",
    fallbackSrc: "/images/blue-economy/catfish-ponds-kenya-card.jpg",
    alt: "Aquaculture ponds supporting fish farming development",
    points: [
      "Fish pond and cage culture development",
      "Farmer training and capacity building",
      "Fingerling production and distribution",
      "Feed production and nutrition management",
      "Aquaculture data systems and production monitoring"
    ]
  }
];

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const { data: summaryData } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => reportsApi.summary()
  });
  const { data: farmers = [] } = useFarmers();
  const { data: licenses = [] } = useLicenses();
  const { data: captureRecords = [] } = useCaptureFisheries();
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
    const totals = farmers.reduce<Record<string, number>>((acc, farmer) => {
      acc[farmer.subCounty] = (acc[farmer.subCounty] ?? 0) + farmer.productionKg;
      return acc;
    }, {});

    captureRecords.forEach((record) => {
      totals[record.subCounty] = (totals[record.subCounty] ?? 0) + record.catchKg;
    });

    return totals;
  }, [captureRecords, farmers]);

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
  const fallbackFarmProductionKg = farmers.reduce((total, item) => total + item.productionKg, 0);
  const fallbackCaptureProductionKg = captureRecords.reduce((total, item) => total + item.catchKg, 0);
  const fallbackTotalProductionKg = fallbackFarmProductionKg + fallbackCaptureProductionKg;
  const fallbackTotalLicenseRevenue = licenses.reduce((total, item) => total + getLicenseRevenue(item), 0);
  const fallbackCompletedProjects = projects.filter((item) => item.status === "COMPLETED").length;
  const fallbackProjectCost = projects.reduce((total, item) => total + item.budget, 0);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time view of fisheries operations and blue economy indicators.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Farmers" value={summaryData?.summary.totalFarmers ?? fallbackTotalFarmers} />
        <StatCard label="Active Licenses" value={summaryData?.summary.activeLicenses ?? fallbackActiveLicenses} />
        <StatCard
          label="Total Production (Kg)"
          value={(summaryData?.summary.totalProductionKg ?? fallbackTotalProductionKg).toLocaleString()}
        />
        <StatCard label="License Revenue" value={formatCurrency(fallbackTotalLicenseRevenue)} />
        <StatCard label="Completed Projects" value={fallbackCompletedProjects} />
        <StatCard label="Project Cost (KES)" value={fallbackProjectCost.toLocaleString()} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {featureCards.map((card) => (
          <article key={card.title} className="overflow-hidden rounded-lg border bg-card">
            <img
              src={card.imageSrc}
              alt={card.alt}
              className="aspect-[16/8] w-full object-cover"
              onError={(event) => {
                const image = event.currentTarget;
                if (image.dataset.fallbackApplied === "true") return;
                image.dataset.fallbackApplied = "true";
                image.src = card.fallbackSrc;
              }}
            />
            <div className="p-4">
              <h2 className="text-base font-semibold">{card.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                {card.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
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
