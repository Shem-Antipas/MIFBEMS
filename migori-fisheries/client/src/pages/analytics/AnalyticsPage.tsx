import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useFarmers } from "@/hooks/useFarmers";

const AnalyticsPage = () => {
  const { data: farmers = [] } = useFarmers();

  const chartData = useMemo(() => {
    const map = farmers.reduce<Record<string, number>>((acc, farmer) => {
      acc[farmer.subCounty] = (acc[farmer.subCounty] ?? 0) + farmer.productionKg;
      return acc;
    }, {});

    return Object.entries(map).map(([subCounty, productionKg]) => ({ subCounty, productionKg }));
  }, [farmers]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <div className="h-80 rounded-xl border bg-white p-4">
        <p className="mb-3 text-sm font-medium">Production Trend by Sub-County</p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="subCounty" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Line type="monotone" dataKey="productionKg" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};

export default AnalyticsPage;
