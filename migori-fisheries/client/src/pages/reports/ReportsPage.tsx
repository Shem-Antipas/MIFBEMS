import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { reportsApi } from "@/api/reports";

const pieColors = ["#0f766e", "#f59e0b", "#dc2626", "#1d4ed8"];

const ReportsPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: reportsApi.summary
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading reports...</div>;
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Reports & Exports</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-xl border bg-white p-4">
          <p className="mb-3 text-sm font-medium">Production by Sub-County</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.productionBySubCounty ?? []}>
              <XAxis dataKey="subCounty" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="_sum.productionKg" fill="#0f766e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-72 rounded-xl border bg-white p-4">
          <p className="mb-3 text-sm font-medium">License Status Mix</p>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data?.licensesByStatus ?? []}
                dataKey="_count.id"
                nameKey="status"
                outerRadius={95}
                label
              >
                {(data?.licensesByStatus ?? []).map((entry, index) => (
                  <Cell key={entry.status} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};

export default ReportsPage;
