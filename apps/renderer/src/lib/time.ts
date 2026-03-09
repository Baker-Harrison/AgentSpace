export function formatDuration(startedAt: string, finishedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const durationMs = Math.max(0, end - start);
  const seconds = Math.floor(durationMs / 1000);
  const ms = Math.floor((durationMs % 1000) / 100);
  return `${seconds}.${ms}s`;
}

export function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(timestamp));
}
