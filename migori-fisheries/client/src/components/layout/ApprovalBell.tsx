import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, ClipboardCheck, FileText, FolderClock } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { captureFisheriesApi } from "@/api/captureFisheries";
import { licensesApi } from "@/api/licenses";
import { projectsApi } from "@/api/projects";
import { Button } from "@/components/ui/button";

type ApprovalItem = {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: typeof ClipboardCheck;
  createdAt?: string;
};

const formatDate = (value?: string): string => {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
};

const ApprovalBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: licenses = [] } = useQuery({
    queryKey: ["approval-notifications", "licenses"],
    queryFn: licensesApi.list,
    refetchInterval: 60_000
  });

  const { data: captureRecords = [] } = useQuery({
    queryKey: ["approval-notifications", "capture-fisheries"],
    queryFn: captureFisheriesApi.list,
    refetchInterval: 60_000
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["approval-notifications", "projects"],
    queryFn: projectsApi.list,
    refetchInterval: 60_000
  });

  const approvalItems = useMemo<ApprovalItem[]>(() => {
    const pendingLicenses = licenses
      .filter((license) => license.status === "PENDING")
      .map((license) => ({
        id: `license-${license.id}`,
        title: "License approval",
        description: `${license.licenseNo} - ${license.holderName ?? license.farmer?.name ?? "Applicant"}`,
        path: "/licenses",
        icon: FileText,
        createdAt: license.createdAt
      }));

    const pendingCaptureRecords = captureRecords
      .filter((record) => record.approvalStatus === "PENDING")
      .map((record) => ({
        id: `capture-${record.id}`,
        title: "Capture fisheries approval",
        description: `${record.captureCode} - ${record.fisherName}`,
        path: "/capture-fisheries",
        icon: ClipboardCheck,
        createdAt: record.createdAt
      }));

    const pendingProjects = projects
      .filter((project) => project.status === "PENDING")
      .map((project) => ({
        id: `project-${project.id}`,
        title: "Project review",
        description: `${project.projectCode} - ${project.name}`,
        path: "/projects",
        icon: FolderClock,
        createdAt: project.createdAt
      }));

    return [...pendingLicenses, ...pendingCaptureRecords, ...pendingProjects]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 8);
  }, [captureRecords, licenses, projects]);

  const pendingCount = approvalItems.length;

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="relative shrink-0"
        aria-label={`Approval notifications${pendingCount ? `, ${pendingCount} pending` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-4 w-4" />
        {pendingCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Approvals</p>
            <p className="text-xs text-muted-foreground">
              {pendingCount > 0 ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} need review` : "No pending approvals"}
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {approvalItems.length > 0 ? (
              approvalItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full gap-3 border-b px-4 py-3 text-left transition last:border-0 hover:bg-secondary"
                    onClick={() => {
                      setOpen(false);
                      navigate(item.path);
                    }}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                  </button>
                );
              })
            ) : (
              <div className="flex items-center gap-3 px-4 py-5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                All caught up
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ApprovalBell;
