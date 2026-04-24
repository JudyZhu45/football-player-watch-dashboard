type StatusBadgeProps = { status: string };

const CONFIG: Record<string, { label: string; className: string; dot?: boolean }> = {
  IN_PLAY: { label: 'Live', className: 'bg-green-100 text-green-800', dot: true },
  LIVE:    { label: 'Live', className: 'bg-green-100 text-green-800', dot: true },
  PAUSED:  { label: 'HT',   className: 'bg-yellow-100 text-yellow-800', dot: true },
  TIMED:   { label: 'Soon', className: 'bg-blue-50 text-blue-700' },
  SCHEDULED: { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' },
  FINISHED:  { label: 'FT', className: 'bg-gray-100 text-gray-500' },
  POSTPONED: { label: 'Postponed', className: 'bg-red-50 text-red-600' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-50 text-red-600' },
  SUSPENDED: { label: 'Suspended', className: 'bg-orange-50 text-orange-600' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.className}`}>
      {cfg.dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-600" />
        </span>
      )}
      {cfg.label}
    </span>
  );
}
