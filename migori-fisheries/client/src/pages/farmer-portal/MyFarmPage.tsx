import { Fish, MapPin, Phone, Sprout, Waves } from "lucide-react";

import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFarmers } from "@/hooks/useFarmers";
import { useAuthStore } from "@/store/authStore";

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border bg-background/70 p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 font-medium">{value}</p>
  </div>
);

const MyFarmPage = () => {
  const user = useAuthStore((state) => state.user);
  const { data: farmers = [], isLoading } = useFarmers();

  const farm =
    farmers.find((item) => item.id === user?.id) ??
    farmers.find((item) => item.name.toLowerCase().includes((user?.name ?? "").toLowerCase())) ??
    farmers[0];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">My Farm</h1>
        <p className="text-sm text-muted-foreground">Your registered fisheries profile, location, production, and unit status.</p>
      </div>

      {farm ? (
        <>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 p-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-white/70">Farmer ID</p>
                  <h2 className="mt-2 text-2xl font-bold">{farm.farmerCode}</h2>
                  <p className="mt-1 text-white/80">{farm.name}</p>
                </div>
                <StatusBadge status={farm.status} />
              </div>
            </div>
            <CardContent className="grid gap-4 p-5 md:grid-cols-4">
              <div className="rounded-xl border bg-emerald-50 p-4 text-emerald-950">
                <Fish className="h-5 w-5" />
                <p className="mt-3 text-xs uppercase tracking-wide opacity-70">Production</p>
                <p className="text-2xl font-bold">{farm.productionKg.toLocaleString()} kg</p>
              </div>
              <div className="rounded-xl border bg-cyan-50 p-4 text-cyan-950">
                <Waves className="h-5 w-5" />
                <p className="mt-3 text-xs uppercase tracking-wide opacity-70">Production Unit</p>
                <p className="text-2xl font-bold">{farm.farmType}</p>
              </div>
              <div className="rounded-xl border bg-amber-50 p-4 text-amber-950">
                <Sprout className="h-5 w-5" />
                <p className="mt-3 text-xs uppercase tracking-wide opacity-70">Species</p>
                <p className="text-lg font-bold">{farm.species.join(", ")}</p>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4 text-slate-950">
                <MapPin className="h-5 w-5" />
                <p className="mt-3 text-xs uppercase tracking-wide opacity-70">Location</p>
                <p className="text-lg font-bold">{farm.subCounty}</p>
                <p className="text-sm opacity-70">{farm.ward}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Farm Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Detail label="Farmer Name" value={farm.name} />
                <Detail label="National ID" value={farm.idNumber ?? "Not provided"} />
                <Detail label="Phone Number" value={farm.phoneNumber ?? "Not provided"} />
                <Detail label="Email" value={farm.email ?? "Not provided"} />
                <Detail label="Sub-County" value={farm.subCounty} />
                <Detail label="Ward" value={farm.ward} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Production Units</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Detail label="Total Units" value={farm.numberOfPonds.toLocaleString()} />
                <Detail label="Active Units" value={farm.activePonds.toLocaleString()} />
                <Detail label="Inactive Units" value={farm.inactivePonds.toLocaleString()} />
                {farm.phoneNumber ? (
                  <a
                    className="flex items-center gap-2 rounded-lg border bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
                    href={`tel:${farm.phoneNumber}`}
                  >
                    <Phone className="h-4 w-4" />
                    Contact registered number
                  </a>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {isLoading ? "Loading your farm record..." : "No linked farm record found. Please contact your fisheries officer for account linking."}
          </CardContent>
        </Card>
      )}
    </section>
  );
};

export default MyFarmPage;
