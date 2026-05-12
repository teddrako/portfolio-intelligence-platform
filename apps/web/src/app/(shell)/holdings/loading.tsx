function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function HoldingsLoading() {
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <Bone className="h-5 w-32" />
        <Bone className="h-8 w-36" />
      </div>

      {/* Portfolio chart */}
      <Bone className="h-48" />

      {/* Summary pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-16" />
        ))}
      </div>

      {/* Holdings table rows */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}
