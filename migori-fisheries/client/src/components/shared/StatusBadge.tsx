import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const normalized = status.toUpperCase();
  const variant: ComponentProps<typeof Badge>["variant"] =
    normalized === "ACTIVE" ||
    normalized === "VALID" ||
    normalized === "PASS" ||
    normalized === "RESOLVED" ||
    normalized === "COMPLETED" ||
    normalized === "APPROVED"
      ? "success"
      : normalized === "PENDING" ||
          normalized === "PLANNED" ||
          normalized === "ONGOING" ||
          normalized === "IN PROGRESS" ||
          normalized === "IN_PROGRESS" ||
          normalized === "PARTIALLY ACTIVE" ||
          normalized === "PARTIALLY_ACTIVE" ||
          normalized === "STALLED"
        ? "warning"
        : "destructive";

  return <Badge variant={variant}>{status}</Badge>;
};

export default StatusBadge;
