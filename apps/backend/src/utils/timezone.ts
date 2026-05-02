import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

const JAKARTA_TZ = 'Asia/Jakarta';

export function getNowInJakarta(): Date {
  return toZonedTime(new Date(), JAKARTA_TZ);
}

export function getTodayInJakarta(): string {
  const now = getNowInJakarta();
  return format(now, 'yyyy-MM-dd');
}

export function getHourInJakarta(date: Date = new Date()): number {
  const jakartaTime = toZonedTime(date, JAKARTA_TZ);
  return jakartaTime.getHours();
}

export function getMinuteInJakarta(date: Date = new Date()): number {
  const jakartaTime = toZonedTime(date, JAKARTA_TZ);
  return jakartaTime.getMinutes();
}

export function isAfter6PM(): boolean {
  const hour = getHourInJakarta();
  return hour >= 18; // 6 PM = 18:00 in 24-hour format
}

export function isAfter2AM(): boolean {
  const hour = getHourInJakarta();
  return hour >= 8; // 2 AM = 08:00 in 24-hour format
}

export function formatDateJakarta(date: Date = new Date(), dateFormat = 'dd MMM yyyy HH:mm:ss'): string {
  return formatInTimeZone(date, JAKARTA_TZ, dateFormat);
}
