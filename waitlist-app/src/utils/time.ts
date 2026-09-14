export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return 'Not set';
  if (minutes <= 0) return 'Any moment now';
  return `${minutes} min`;
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return '';
  const target = new Date(iso).getTime();
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 'Deadline passed';
  const minutes = Math.ceil(diffMs / 60_000);
  return `${minutes} min left to confirm`;
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? '1 hr ago' : `${hours} hrs ago`;
}
