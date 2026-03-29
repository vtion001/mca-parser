export function SkeletonRow({ index = 0 }: { index?: number }) {
  return (
    <div
      className="bg-white rounded-xl border border-bw-100 shadow-card px-6 py-5 animate-pulse"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center gap-8">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-bw-100 rounded" />
          <div className="h-3 w-24 bg-bw-100 rounded" />
        </div>
        <div className="h-8 w-48 bg-bw-100 rounded" />
        <div className="h-10 w-10 bg-bw-100 rounded-full" />
      </div>
    </div>
  );
}
