interface MapLegendProps {
  title: string;
  stops: string[];
  ranges: string[];
}

const MapLegend = ({ title, stops, ranges }: MapLegendProps) => {
  return (
    <div className="absolute bottom-4 left-4 z-[500] w-44 rounded-lg border bg-white/95 p-3 shadow">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full">
        <div
          className="h-full w-full"
          style={{
            background: `linear-gradient(to right, ${stops.join(",")})`
          }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{ranges[0]}</span>
        <span>{ranges[ranges.length - 1]}</span>
      </div>
    </div>
  );
};

export default MapLegend;
