import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";

interface PageLayoutProps {
  children: ReactNode;
}

const PageLayout = ({ children }: PageLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileMenuOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      mediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Sidebar />
      <div className="min-w-0">
        <Navbar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="min-w-0 p-3 sm:p-4 lg:p-6">{children}</main>
      </div>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative h-full max-w-[18rem] bg-card shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <Sidebar mobile onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PageLayout;
