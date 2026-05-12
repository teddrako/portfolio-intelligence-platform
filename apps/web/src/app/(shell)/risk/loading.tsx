function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function RiskLoading() {
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <Bone className="h-5 w-44" />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-20" />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Bone className="h-64" />
        <Bone className="h-64" />
      </div>

      {/* Sector exposure + correlation */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Bone className="h-56" />
        <Bone className="h-56" />
      </div>
    </div>
  );
}
