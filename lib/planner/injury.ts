import type { InjuryPeriod } from '@/lib/onboarding/dossier';

/** True se `date` (YYYY-MM-DD) cade in uno dei periodi di infortunio. */
export function isInjured(date: string, periods: InjuryPeriod[]): boolean {
  return periods.some(p => date >= p.start && date <= p.end);
}

/** Date YYYY-MM-DD della settimana che cadono in infortunio. */
export function injuredDatesInWeek(
  weekDates: string[],
  periods: InjuryPeriod[],
): Set<string> {
  return new Set(weekDates.filter(d => isInjured(d, periods)));
}
