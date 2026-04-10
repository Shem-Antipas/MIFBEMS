import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { usersApi } from "@/api/users";
import { useAuthStore } from "@/store/authStore";
import { MIGORI_SUBCOUNTIES } from "@/lib/locationData";
import { Input } from "@/components/ui/input";
import type { Role } from "@/types";

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: Role;
  subCounty?: string;
};

const roles: Role[] = ["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER", "ADMIN"];

const UsersPage = () => {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const canManageUsers = currentUser?.role === "DIRECTOR" || currentUser?.role === "ADMIN";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list
  });

  const { register, handleSubmit, reset, watch } = useForm<UserForm>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "FISHERIES_OFFICER",
      subCounty: "Suna East"
    }
  });

  const selectedRole = watch("role");

  const createUser = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const deactivateUser = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">System Users</h1>

      {canManageUsers ? (
        <form
          className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3"
          onSubmit={handleSubmit(async (values) => {
            try {
              await createUser.mutateAsync({
                name: values.name,
                email: values.email,
                password: values.password,
                role: values.role,
                subCounty: ["FISHERIES_OFFICER", "FARMER"].includes(values.role) ? values.subCounty : undefined,
                isActive: true
              });
              toast.success("User created successfully");
              reset({
                name: "",
                email: "",
                password: "",
                role: "FISHERIES_OFFICER",
                subCounty: "Suna East"
              });
            } catch (error) {
              const message =
                (error as AxiosError<{ error?: string }>).response?.data?.error ??
                "Failed to create user.";
              toast.error(message);
            }
          })}
        >
          <Input placeholder="Full name" {...register("name", { required: true })} />
          <Input type="email" placeholder="Email" {...register("email", { required: true })} />
          <Input type="password" placeholder="Temporary password" {...register("password", { required: true })} />

          <select className="rounded-lg border px-3 py-2 text-sm" {...register("role", { required: true })}>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          {selectedRole === "FISHERIES_OFFICER" || selectedRole === "FARMER" ? (
            <select className="rounded-lg border px-3 py-2 text-sm" {...register("subCounty", { required: true })}>
              {MIGORI_SUBCOUNTIES.map((subCounty) => (
                <option key={subCounty} value={subCounty}>
                  {subCounty}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">Sub-county not required</div>
          )}

          <div className="md:col-span-3 flex justify-end">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-white" type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Saving..." : "Add User"}
            </button>
          </div>
        </form>
      ) : null}

      <DataTable
        headers={["Name", "Email", "Role", "Sub-County", "Status", "Actions"]}
        rows={users.map((user) => [
          user.name,
          user.email,
          user.role,
          user.subCounty ?? "All",
          <StatusBadge key={user.id} status={user.isActive ? "ACTIVE" : "INACTIVE"} />,
          canManageUsers && user.isActive && user.id !== currentUser?.id ? (
            <button
              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700"
              disabled={deactivateUser.isPending}
              onClick={async () => {
                try {
                  await deactivateUser.mutateAsync(user.id);
                  toast.success("User deactivated");
                } catch (error) {
                  const message =
                    (error as AxiosError<{ error?: string }>).response?.data?.error ??
                    "Failed to deactivate user.";
                  toast.error(message);
                }
              }}
            >
              Deactivate
            </button>
          ) : (
            "-"
          )
        ])}
        emptyLabel={isLoading ? "Loading users..." : "No users found."}
      />
    </section>
  );
};

export default UsersPage;
