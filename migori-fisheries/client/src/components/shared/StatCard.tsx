import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  helper?: string;
}

const StatCard = ({ label, value, helper }: StatCardProps) => {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-normal text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
};

export default StatCard;
