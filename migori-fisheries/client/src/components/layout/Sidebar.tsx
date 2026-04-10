import { NavLink } from "react-router-dom";
import { navItems } from "@/router/permissions";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const role = useAuthStore((state) => state.user?.role);

  const items = navItems.filter((item) => (role ? item.allowedRoles.includes(role) : false));

  return (
    <aside className="hidden min-h-screen w-64 border-r bg-white/80 px-4 py-6 lg:block">
      <div className="mb-8 px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">MiFBEMS</p>
        <h1 className="mt-2 text-lg font-bold text-foreground">Migori Fisheries</h1>
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "block rounded-xl px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
