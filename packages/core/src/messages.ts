import { localParts } from './equipment';

/**
 * Text messages (docs/SPEC.md section 13). Sent only to numbers with consent; held during quiet hours. No marketing.
 * Every message names the company first so the person knows who's texting.
 */
export type Template = 'estimate_sent' | 'change_order' | 'scheduled' | 'weather_reschedule' | 'invoice' | 'phc_copy' | 'crew_link' | 'deposit_received';
export type Locale = 'en' | 'es';

const T: Record<Template, Record<Locale, string>> = {
  estimate_sent: {
    en: '{company}: your tree estimate is ready. View and approve: {link}. Reply STOP to opt out.',
    es: '{company}: su presupuesto de árboles está listo. Véalo y apruébelo: {link}. Responda STOP para no recibir mensajes.',
  },
  change_order: {
    en: '{company}: the crew added work for {amount}. Review and sign: {link}. Reply STOP to opt out.',
    es: '{company}: el equipo agregó trabajo por {amount}. Revíselo y firme: {link}. Responda STOP para no recibir mensajes.',
  },
  scheduled: {
    en: '{company}: your tree work is set for {date}. Reply STOP to opt out.',
    es: '{company}: su trabajo de árboles está programado para el {date}. Responda STOP para no recibir mensajes.',
  },
  weather_reschedule: {
    en: '{company}: weather moved your job to {date}. Questions? Call {phone}.',
    es: '{company}: por el clima su trabajo pasó al {date}. ¿Preguntas? Llame al {phone}.',
  },
  invoice: {
    en: '{company}: your invoice for {amount} is ready: {link}',
    es: '{company}: su factura de {amount} está lista: {link}',
  },
  phc_copy: {
    en: '{company}: your treatment record from {date} is here: {link}',
    es: '{company}: su registro de tratamiento del {date} está aquí: {link}',
  },
  crew_link: {
    en: '{company}: your job for {date} at {address}. Open: {link}',
    es: '{company}: su trabajo del {date} en {address}. Abrir: {link}',
  },
  deposit_received: {
    en: '{company}: we got your deposit of {amount}. Thank you.',
    es: '{company}: recibimos su depósito de {amount}. Gracias.',
  },
};

export const TEMPLATES = Object.keys(T) as Template[];

export function render(template: Template, locale: Locale, vars: Record<string, string>): string {
  const text = T[template][locale] ?? T[template].en;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

/** Quiet hours wrap past midnight: quiet from `start` (21) until `end` (8). */
export function inQuietHours(at: Date, timeZone: string, s: { quiet_start_hour: number; quiet_end_hour: number }): boolean {
  const { hour } = localParts(at, timeZone);
  return s.quiet_start_hour > s.quiet_end_hour ? hour >= s.quiet_start_hour || hour < s.quiet_end_hour : hour >= s.quiet_start_hour && hour < s.quiet_end_hour;
}

/** The next moment texting is allowed, stepping an hour at a time. */
export function nextSendTime(at: Date, timeZone: string, s: { quiet_start_hour: number; quiet_end_hour: number }): Date {
  let t = new Date(at);
  for (let i = 0; i < 25 && inQuietHours(t, timeZone, s); i++) t = new Date(Math.floor(+t / 3_600_000) * 3_600_000 + 3_600_000);
  return t;
}

/** (216) 555-0100 from +12165550100 or 2165550100. Anything else is shown as typed. */
export function prettyPhone(p: string | null | undefined): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

/** +1XXXXXXXXXX, or null when it isn't a US number. */
export function toE164(p: string | null | undefined): string | null {
  if (!p) return null;
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `+1${d}` : null;
}
