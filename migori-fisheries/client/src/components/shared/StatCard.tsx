interface StatCardProps {
  label: string;
  value: string | number;
  helper?: string;
}

const StatCard = ({ label, value, helper }: StatCardProps) => {
  return (
    <article className="rounded-xl border bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </article>
  );
};

export default StatCard;
