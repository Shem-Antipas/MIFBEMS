import { useAuthStore } from "@/store/authStore";
import { formatRole } from "@/lib/utils";

const Navbar = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <div>
        <h2 className="text-lg font-semibold">Migori County Fisheries Dashboard</h2>
        <p className="text-xs text-muted-foreground">Role: {user ? formatRole(user.role) : "Unknown"}</p>
      </div>
      <button
        onClick={() => void logout()}
        className="rounded-lg border px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
      >
        Sign out
      </button>
    </header>
  );
};

export default Navbar;
