import { useAuthStore } from "@/store/authStore";
import { useFarmers } from "@/hooks/useFarmers";

const MyFarmPage = () => {
  const userId = useAuthStore((state) => state.user?.id);
  const { data: farmers = [] } = useFarmers();

  const farm = farmers.find((item) => item.id === userId);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">My Farm</h1>
      {farm ? (
        <div className="rounded-xl border bg-white p-4 text-sm">
          <p><strong>Name:</strong> {farm.name}</p>
          <p><strong>Sub-County:</strong> {farm.subCounty}</p>
          <p><strong>Farm Type:</strong> {farm.farmType}</p>
          <p><strong>Production:</strong> {farm.productionKg.toLocaleString()} kg</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No linked farm record found.</p>
      )}
    </section>
  );
};

export default MyFarmPage;
