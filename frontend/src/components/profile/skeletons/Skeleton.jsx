// frontend/src/components/profile/skeletons/Skeleton.jsx
export function Skeleton({ className = '', height = 14 }) {
  return (
    <div
      className={`cv-shimmer rounded ${className}`}
      style={{ height, background: 'rgba(127,127,127,.12)' }}
    />
  );
}
export function CardSkeleton({ rows = 4 }) {
  return (
    <div className="cv-glass p-5 space-y-3">
      <Skeleton className="w-1/3" height={12} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="w-full" height={14} />
      ))}
    </div>
  );
}
