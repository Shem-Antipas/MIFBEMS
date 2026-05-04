import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const normalized = status.toUpperCase();
  const variant: ComponentProps<typeof Badge>["variant"] =
    normalized === "ACTIVE" || normalized === "VALID" || normalized === "PASS" || normalized === "RESOLVED"
      ? "success"
      : normalized === "PENDING" || normalized === "PLANNED" || normalized === "ONGOING"
        ? "warning"
        : "destructive";

  return <Badge variant={variant}>{status}</Badge>;
};

export default StatusBadge;
