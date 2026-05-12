function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ""}`} />;
}

export default function CalendarLoading() {
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <Bone className="h-5 w-36" />

      {/* Two-column layout: macro events + earnings */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Bone className="h-4 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} className="h-16" />
          ))}
        </div>
        <div className="space-y-3">
          <Bone className="h-4 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} className="h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}
