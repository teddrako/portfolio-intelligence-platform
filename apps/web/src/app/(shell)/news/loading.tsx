function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function NewsLoading() {
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <Bone className="h-5 w-40" />
        <Bone className="h-8 w-28" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} className="h-8 w-20" />
        ))}
      </div>

      {/* Article cards */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bone key={i} className="h-24" />
        ))}
      </div>
    </div>
  );
}
