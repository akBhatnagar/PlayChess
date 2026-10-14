/** Whole milliseconds, shown as m:ss, with tenths under 20 seconds. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base =
    hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      : `${minutes}:${seconds.toString().padStart(2, "0")}`;
  if (clamped < 20_000 && hours === 0) {
    const tenths = Math.floor((clamped % 1000) / 100);
    return `${base}.${tenths}`;
  }
  return base;
}
