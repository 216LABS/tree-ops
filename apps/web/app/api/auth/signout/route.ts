import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/auth';
import { baseUrl } from '@/lib/env';

export async function POST() {
  await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(`${baseUrl()}/login`, { status: 303 });
}
