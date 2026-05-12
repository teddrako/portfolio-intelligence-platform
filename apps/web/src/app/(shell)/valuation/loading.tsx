function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function ValuationLoading() {
  return (
    <div className="flex h-full gap-0">
      {/* Ticker sidebar */}
      <div className="w-48 shrink-0 space-y-2 border-r border-white/5 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bone key={i} className="h-10" />
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 space-y-5 p-5">
        <div className="flex items-center justify-between">
          <Bone className="h-6 w-32" />
          <Bone className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Bone key={i} className="h-20" />
          ))}
        </div>
        <Bone className="h-64" />
        <Bone className="h-48" />
      </div>
    </div>
  );
}
