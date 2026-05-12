function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function ReportsLoading() {
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <Bone className="h-5 w-40" />
        <Bone className="h-9 w-36" />
      </div>

      {/* Report cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}
