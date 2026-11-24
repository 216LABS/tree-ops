'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Button, Input, Label } from '@treeops/ui';
import { useState } from 'react';
import { api, ApiError } from '@/components/client-api';
import { ErrorNote } from '@/components/actions';

const supabase = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

/**
 * Sign in with email and password, or with your company's single sign-on. No sign-in emails are sent (the text-only
 * rule from Flake); the owner sets each person's first password in Settings.
 */
export function LoginForm({ demo }: { demo: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = () => window.location.assign('/dashboard');

  return (
    <div>
      <h1 className="font-display mb-4 text-2xl font-semibold">{mode === 'in' ? 'Sign in' : 'Start your company'}</h1>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          const sb = supabase();
          const { error } = mode === 'in' ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
          setBusy(false);
          if (error) return setErr(mode === 'in' ? 'That email and password don’t match.' : error.message);
          go();
        }}
      >
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}</Button>
      </form>
      <ErrorNote>{err}</ErrorNote>
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="min-h-10 text-link underline" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'New company? Start here' : 'I have an account'}</button>
        <button
          type="button"
          className="min-h-10 text-link underline"
          onClick={async () => {
            setErr(null);
            if (!email) return setErr('Type your work email first.');
            try {
              const out = await api<{ url: string }>('/api/auth/sso', { body: { email } });
              window.location.assign(out.url);
            } catch (e) {
              setErr(e instanceof ApiError ? e.message : 'Single sign-on didn’t start.');
            }
          }}
        >
          Company single sign-on
        </button>
      </div>
      {demo ? (
        <div className="mt-6 border-t border-line-faint pt-4">
          <p className="mb-2 text-sm text-muted">Try it with a made-up company:</p>
          <div className="flex flex-wrap gap-2">
            {(['owner', 'sales', 'office'] as const).map((as) => (
              <Button
                key={as}
                variant={as === 'owner' ? 'primary' : 'outline'}
                data-testid={`demo-${as}`}
                onClick={async () => {
                  try {
                    await api('/api/auth/demo', { body: { as } });
                    go();
                  } catch (e) {
                    setErr(e instanceof ApiError ? e.message : 'Demo sign-in failed.');
                  }
                }}
              >
                {as === 'owner' ? 'Use the demo company' : as === 'sales' ? 'As the sales arborist' : 'As the office'}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
