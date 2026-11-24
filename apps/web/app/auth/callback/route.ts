import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/auth';
import { baseUrl } from '@/lib/env';

/** Where single sign-on lands: swap the code for a session, then go to the app. */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code');
  if (code) await (await supabaseServer()).auth.exchangeCodeForSession(code);
  return NextResponse.redirect(`${baseUrl()}/dashboard`);
}
