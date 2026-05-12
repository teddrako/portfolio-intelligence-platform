function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function BacktestLoading() {
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <Bone className="h-5 w-36" />

      {/* Config panel */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-16" />
        ))}
      </div>

      {/* Chart */}
      <Bone className="h-64" />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}
