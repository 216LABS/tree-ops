/** How dates and times read on screen: the company's time zone, plain words. */
export const fmtDay = (day: string | null | undefined) => (day ? new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');
export const fmtDate = (d: Date | string | null | undefined, tz: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: tz }) : '');
export const fmtTime = (d: Date | string | null | undefined, tz: string) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz }) : '');
export const todayIn = (tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const JOB_STATUS: Record<string, [string, 'gray' | 'blue' | 'green' | 'amber' | 'red']> = {
  unscheduled: ['Not scheduled', 'amber'], scheduled: ['Scheduled', 'blue'], in_progress: ['Working', 'blue'], done: ['Done, to bill', 'amber'], billed: ['Billed', 'green'], cancelled: ['Cancelled', 'gray'],
};
export const EST_STATUS: Record<string, [string, 'gray' | 'blue' | 'green' | 'amber' | 'red']> = {
  draft: ['Draft', 'gray'], sent: ['Sent', 'blue'], approved: ['Approved', 'green'], declined: ['Declined', 'red'], expired: ['Expired', 'gray'],
};
export const INV_STATUS: Record<string, [string, 'gray' | 'blue' | 'green' | 'amber' | 'red']> = { draft: ['Draft', 'amber'], sent: ['Sent', 'blue'], paid: ['Paid', 'green'], void: ['Void', 'gray'] };
export const DAY_STATUS: Record<string, [string, 'gray' | 'blue' | 'green' | 'amber' | 'red']> = { planned: ['Planned', 'gray'], briefed: ['Briefed', 'blue'], working: ['Working', 'blue'], closed: ['Closed', 'green'], weather_hold: ['Weather hold', 'amber'] };
