import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import ApprovalBell from "@/components/layout/ApprovalBell";
import { useAuthStore } from "@/store/authStore";
import { formatRole } from "@/lib/utils";

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar = ({ onMenuClick }: NavbarProps) => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const canApprove = user?.role === "DIRECTOR" || user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card/95 px-3 py-3 backdrop-blur sm:px-6 lg:static lg:py-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <img src="/migori-county-logo.png" alt="Migori County Government" className="h-9 w-9 shrink-0 lg:hidden" />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold sm:text-lg">
            <span className="sm:hidden">MiFBeDAS</span>
            <span className="hidden sm:inline">Migori Fisheries and Blue Economy Data & Analytics System</span>
          </h2>
          <p className="truncate text-xs text-muted-foreground">Role: {user ? formatRole(user.role) : "Unknown"}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canApprove ? <ApprovalBell /> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
};

export default Navbar;
