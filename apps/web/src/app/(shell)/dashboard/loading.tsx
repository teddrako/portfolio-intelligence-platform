function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Bone className="h-5 w-40" />
          <Bone className="h-3 w-24" />
        </div>
        <Bone className="h-8 w-36" />
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-20" />
        ))}
      </div>

      {/* Holdings + news grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Bone className="h-72 xl:col-span-3" />
        <Bone className="h-72 xl:col-span-2" />
      </div>

      {/* Recent transactions */}
      <Bone className="h-40" />
    </div>
  );
}
