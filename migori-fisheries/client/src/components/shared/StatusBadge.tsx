import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
}

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const normalized = status.toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        normalized === "ACTIVE" || normalized === "VALID" || normalized === "PASS" || normalized === "RESOLVED"
          ? "bg-green-100 text-green-700"
          : normalized === "PENDING" || normalized === "PLANNED" || normalized === "ONGOING"
            ? "bg-amber-100 text-amber-800"
            : "bg-red-100 text-red-700"
      )}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
