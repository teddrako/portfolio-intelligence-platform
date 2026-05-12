function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function OptionsLoading() {
  return (
    <div className="flex h-full gap-0">
      {/* Ticker sidebar */}
      <div className="w-48 shrink-0 space-y-2 border-r border-white/5 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bone key={i} className="h-10" />
        ))}
      </div>

      {/* Chain panel */}
      <div className="flex-1 space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Bone className="h-9 w-48" />
          <Bone className="h-9 w-32" />
        </div>
        {/* Chain table */}
        <Bone className="h-96" />
        {/* Payoff diagram */}
        <Bone className="h-48" />
      </div>
    </div>
  );
}
