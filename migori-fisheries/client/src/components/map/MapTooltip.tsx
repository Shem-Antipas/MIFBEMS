interface MapTooltipProps {
  name: string;
  farmers: number;
  production: number;
  licenses: number;
  complianceRate: number;
}

const MapTooltip = ({ name, farmers, production, licenses, complianceRate }: MapTooltipProps) => {
  return (
    <div className="rounded-lg border bg-card p-3 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{name}</p>
      <p className="mt-1 text-muted-foreground">Farmers: {farmers}</p>
      <p className="text-muted-foreground">Production: {production.toLocaleString()} kg</p>
      <p className="text-muted-foreground">Licenses: {licenses}</p>
      <p className="text-muted-foreground">Compliance: {complianceRate.toFixed(1)}%</p>
    </div>
  );
};

export default MapTooltip;
