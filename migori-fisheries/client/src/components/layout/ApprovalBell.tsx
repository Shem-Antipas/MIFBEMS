import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, CheckCircle2, ClipboardCheck, FileQuestion, FileText, FolderClock, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { advisoriesApi } from "@/api/advisories";
import { captureFisheriesApi } from "@/api/captureFisheries";
import { inspectionsApi } from "@/api/inspections";
import { licensesApi } from "@/api/licenses";
import { projectsApi } from "@/api/projects";
import { queriesApi } from "@/api/queries";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/authStore";

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
  const user = useAuthStore((state) => state.user);
  const canSeeApprovals = user?.role === "DIRECTOR" || user?.role === "ADMIN";
  const canSeeQueries = user?.role === "DIRECTOR" || user?.role === "ADMIN" || user?.role === "FISHERIES_OFFICER";
  const isFarmer = user?.role === "FARMER";

  const { data: licenses = [] } = useQuery({
    queryKey: ["approval-notifications", "licenses"],
    queryFn: licensesApi.list,
    enabled: canSeeApprovals,
    refetchInterval: 60_000
  });

  const { data: captureRecords = [] } = useQuery({
    queryKey: ["approval-notifications", "capture-fisheries"],
    queryFn: captureFisheriesApi.list,
    enabled: canSeeApprovals,
    refetchInterval: 60_000
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["approval-notifications", "projects"],
    queryFn: projectsApi.list,
    enabled: canSeeApprovals,
    refetchInterval: 60_000
  });

  const { data: queries = [] } = useQuery({
    queryKey: ["notification-bell", "queries"],
    queryFn: queriesApi.list,
    enabled: canSeeQueries || isFarmer,
    refetchInterval: 60_000
  });

  const { data: advisories = [] } = useQuery({
    queryKey: ["notification-bell", "advisories"],
    queryFn: advisoriesApi.list,
    enabled: isFarmer,
    refetchInterval: 60_000
  });

  const { data: inspections = [] } = useQuery({
    queryKey: ["notification-bell", "inspections"],
    queryFn: inspectionsApi.list,
    enabled: isFarmer,
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

    const pendingQueries = queries
      .filter((query) => query.status === "PENDING")
      .map((query) => ({
        id: `query-${query.id}`,
        title: "Farmer query",
        description: `${query.user?.name ?? "Farmer"} - ${query.subject}`,
        path: "/queries",
        icon: FileQuestion,
        createdAt: query.createdAt
      }));

    const farmerQueryReplies = queries
      .filter((query) => query.status === "RESOLVED" && query.reply)
      .map((query) => ({
        id: `query-reply-${query.id}`,
        title: "Query response",
        description: query.subject,
        path: "/farmer/queries",
        icon: FileQuestion,
        createdAt: query.repliedAt ?? query.updatedAt
      }));

    const farmerAdvisories = advisories.slice(0, 5).map((advisory) => ({
      id: `advisory-${advisory.id}`,
      title: advisory.targetUserId ? "Direct advisory" : "Advisory",
      description: advisory.title,
      path: "/farmer/advisories",
      icon: Megaphone,
      createdAt: advisory.createdAt
    }));

    const farmerExtensionFeedback = inspections
      .filter((inspection) => inspection.feedback || inspection.challenges)
      .map((inspection) => ({
        id: `extension-feedback-${inspection.id}`,
        title: "Extension feedback",
        description: `${inspection.farmName} - ${inspection.feedback ?? inspection.challenges ?? "Feedback available"}`,
        path: "/inspections",
        icon: ClipboardCheck,
        createdAt: inspection.createdAt
      }));

    return [
      ...pendingLicenses,
      ...pendingCaptureRecords,
      ...pendingProjects,
      ...(canSeeQueries ? pendingQueries : []),
      ...(isFarmer ? [...farmerQueryReplies, ...farmerAdvisories, ...farmerExtensionFeedback] : [])
    ]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 8);
  }, [advisories, canSeeQueries, captureRecords, inspections, isFarmer, licenses, projects, queries]);

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
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {pendingCount > 0 ? `${pendingCount} item${pendingCount === 1 ? "" : "s"} need attention` : "No pending notifications"}
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
