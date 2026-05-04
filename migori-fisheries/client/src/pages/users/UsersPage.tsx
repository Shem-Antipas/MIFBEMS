import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import DataTable from "@/components/shared/DataTable";
import ExportButton from "@/components/shared/ExportButton";
import StatusBadge from "@/components/shared/StatusBadge";
import { usersApi } from "@/api/users";
import { useAuthStore } from "@/store/authStore";
import { MIGORI_SUBCOUNTIES } from "@/lib/locationData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRole } from "@/lib/utils";
import type { ExcelColumn } from "@/lib/exportToExcel";
import type { Role, User } from "@/types";

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: Role;
  subCounty?: string;
};

const roles: Role[] = ["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "FARMER", "ADMIN"];
const rolesWithOperationalArea: Role[] = ["FISHERIES_OFFICER", "FARMER"];

type AssignmentDraft = {
  role: Role;
  subCounty: string;
};

const userExportColumns = [
  { header: "Name", value: "name" },
  { header: "Email", value: "email" },
  { header: "Role", value: "role" },
  { header: "Sub-County", value: (user: User) => user.subCounty ?? "All" },
  { header: "Status", value: (user: User) => user.isActive ? "ACTIVE" : "INACTIVE" },
  { header: "Created At", value: (user: User) => user.createdAt ? new Date(user.createdAt) : "" }
] satisfies Array<ExcelColumn<User>>;

const UsersPage = () => {
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const canManageUsers = currentUser?.role === "DIRECTOR" || currentUser?.role === "ADMIN";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.list
  });

  const { register, handleSubmit, reset, control } = useForm<UserForm>({
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "FISHERIES_OFFICER",
      subCounty: "Suna East"
    }
  });

  const selectedRole = useWatch({ control, name: "role" });
  const selectedRoleNeedsArea = rolesWithOperationalArea.includes(selectedRole);

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

  const updateUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { role: Role; subCounty: string | null } }) =>
      usersApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const getDraft = (user: User): AssignmentDraft => ({
    role: assignmentDrafts[user.id]?.role ?? user.role,
    subCounty: assignmentDrafts[user.id]?.subCounty ?? user.subCounty ?? "Suna East"
  });

  const setDraft = (user: User, draft: Partial<AssignmentDraft>) => {
    const currentDraft = getDraft(user);
    setAssignmentDrafts((prev) => ({
      ...prev,
      [user.id]: {
        ...currentDraft,
        ...draft
      }
    }));
  };

  const saveAssignment = async (user: User) => {
    const draft = getDraft(user);
    const needsArea = rolesWithOperationalArea.includes(draft.role);

    try {
      await updateUser.mutateAsync({
        id: user.id,
        payload: {
          role: draft.role,
          subCounty: needsArea ? draft.subCounty : null
        }
      });
      setAssignmentDrafts((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
      toast.success("User assignment updated");
    } catch (error) {
      const message =
        (error as AxiosError<{ error?: string }>).response?.data?.error ??
        "Failed to update user assignment.";
      toast.error(message);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">System Users</h1>
        <ExportButton
          filename="system-users"
          sheetName="Users"
          columns={userExportColumns}
          rows={users}
        />
      </div>

      {canManageUsers ? (
        <form
          className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3"
          onSubmit={handleSubmit(async (values) => {
            try {
              await createUser.mutateAsync({
                name: values.name,
                email: values.email,
                password: values.password,
                role: values.role,
                subCounty: rolesWithOperationalArea.includes(values.role) ? values.subCounty : null,
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
          <div className="md:col-span-3">
            <h2 className="text-base font-semibold">Create User</h2>
            <p className="text-sm text-muted-foreground">
              Director and Admin users can create accounts and assign operating areas.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Full Name</label>
            <Input placeholder="Full name" {...register("name", { required: true })} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <Input type="email" placeholder="Email" {...register("email", { required: true })} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Temporary Password</label>
            <Input type="password" placeholder="Temporary password" {...register("password", { required: true })} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Role</label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("role", { required: true })}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Operating Area</label>
            {selectedRoleNeedsArea ? (
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register("subCounty", { required: true })}>
                {MIGORI_SUBCOUNTIES.map((subCounty) => (
                  <option key={subCounty} value={subCounty}>
                    {subCounty}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">County-wide access</div>
            )}
          </div>

          <div className="md:col-span-3 flex justify-end">
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? "Saving..." : "Add User"}
            </Button>
          </div>
        </form>
      ) : null}

      <DataTable
        headers={["Name", "Email", "Role", "Operating Area", "Status", "Assignment", "Actions"]}
        rows={users.map((user) => {
          const draft = getDraft(user);
          const draftNeedsArea = rolesWithOperationalArea.includes(draft.role);
          const changed =
            draft.role !== user.role || (draftNeedsArea ? draft.subCounty !== user.subCounty : user.subCounty !== null);

          return [
            user.name,
            user.email,
            formatRole(user.role),
            user.subCounty ?? "County-wide",
            <StatusBadge key={user.id} status={user.isActive ? "ACTIVE" : "INACTIVE"} />,
            canManageUsers ? (
              <div className="grid min-w-72 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  value={draft.role}
                  disabled={!user.isActive || updateUser.isPending}
                  onChange={(event) => setDraft(user, { role: event.target.value as Role })}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {formatRole(role)}
                    </option>
                  ))}
                </select>
                {draftNeedsArea ? (
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    value={draft.subCounty}
                    disabled={!user.isActive || updateUser.isPending}
                    onChange={(event) => setDraft(user, { subCounty: event.target.value })}
                  >
                    {MIGORI_SUBCOUNTIES.map((subCounty) => (
                      <option key={subCounty} value={subCounty}>
                        {subCounty}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-md border bg-muted/20 px-2 py-2 text-xs text-muted-foreground">
                    County-wide
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!user.isActive || !changed || updateUser.isPending}
                  onClick={() => void saveAssignment(user)}
                >
                  Save
                </Button>
              </div>
            ) : (
              "-"
            ),
            canManageUsers && user.isActive && user.id !== currentUser?.id ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
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
              </Button>
            ) : (
              "-"
            )
          ];
        })}
        emptyLabel={isLoading ? "Loading users..." : "No users found."}
      />
    </section>
  );
};

export default UsersPage;
