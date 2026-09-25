import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// ----------------------------------------------------------------------

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Every consultation slot is defined in IST server-side — MORNING means 09:00–11:59
 * India time, not 09:00 wherever the coordinator happens to be sitting. Formatting and
 * picking both pin to this zone so a laptop set to another timezone cannot silently
 * shift a confirmed call.
 */
export const IST = 'Asia/Kolkata';

/** @output 15 Jan 2030 10:30 am */
export function fIstDateTime(date: string | null | undefined): string {
  if (!date || !dayjs(date).isValid()) {
    return '—';
  }

  return dayjs(date).tz(IST).format('DD MMM YYYY h:mm a');
}

/** @output 15 Jan 2030 */
export function fIstDate(date: string | null | undefined): string {
  if (!date || !dayjs(date).isValid()) {
    return '—';
  }

  return dayjs(date).tz(IST).format('DD MMM YYYY');
}
