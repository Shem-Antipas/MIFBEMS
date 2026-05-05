import { NavLink } from "react-router-dom";
import { navItems } from "@/router/permissions";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

const Sidebar = ({ mobile = false, onNavigate }: SidebarProps) => {
  const role = useAuthStore((state) => state.user?.role);

  const items = navItems.filter((item) => (role ? item.allowedRoles.includes(role) : false));

  return (
    <aside
      className={cn(
        "w-64 border-r bg-card/95 px-4 py-6",
        mobile ? "h-full overflow-y-auto" : "fixed inset-y-0 left-0 z-40 hidden overflow-y-auto lg:block"
      )}
    >
      <div className="mb-8 flex items-center gap-3 px-2">
        <img src="/migori-county-logo.png" alt="Migori County Government" className="h-12 w-12 shrink-0" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">MiFBeDAS</p>
          <h1 className="mt-1 text-base font-bold leading-tight text-foreground">Migori Fisheries & Blue Economy</h1>
        </div>
      </div>
      <nav className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "block rounded-lg px-3 py-2 text-sm font-medium transition",
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
