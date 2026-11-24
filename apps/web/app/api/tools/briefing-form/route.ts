import { renderBriefingForm } from '@treeops/providers/pdf';
import { clientIp, rateLimit } from '@/lib/http';

/** The free printable job briefing form (M16), English or Spanish. No account. */
export async function GET(req: Request) {
  rateLimit(`tool:${clientIp(req)}`, 30);
  const url = new URL(req.url);
  const locale = url.searchParams.get('lang') === 'es' ? 'es' : 'en';
  const company = (url.searchParams.get('company') ?? '').slice(0, 80).trim() || undefined;
  const pdf = await renderBriefingForm({ locale, company });
  return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="tree-job-briefing-${locale}.pdf"`, 'Cache-Control': company ? 'no-store' : 'public, max-age=86400' } });
}
