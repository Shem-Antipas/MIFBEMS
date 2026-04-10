import { useQuery } from "@tanstack/react-query";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { usersApi } from "@/api/users";

const UsersPage = () => {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list
  });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">System Users</h1>
      <DataTable
        headers={["Name", "Email", "Role", "Sub-County", "Status"]}
        rows={users.map((user) => [
          user.name,
          user.email,
          user.role,
          user.subCounty ?? "All",
          <StatusBadge key={user.id} status="ACTIVE" />
        ])}
        emptyLabel={isLoading ? "Loading users..." : "No users found."}
      />
    </section>
  );
};

export default UsersPage;
