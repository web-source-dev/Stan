/** Human-readable booking status for dashboards and manage pages. */
export function bookingDisplayStatus(booking: { status: string; startAt: Date; endAt: Date }): string {
  if (booking.status === 'cancelled') return 'cancelled';
  if (booking.status === 'pending_payment') return 'pending payment';
  const now = Date.now();
  if (booking.endAt.getTime() <= now) return 'completed';
  if (booking.startAt.getTime() <= now) return 'in progress';
  return 'confirmed';
}
