# Deploying Tree Ops (tree.216labs.dev)

Same setup as Flake (`flake/docs/DEPLOY.md`): Vercel for the app, Supabase for the database, sign-in and photos,
Supabase `pg_cron` for background jobs (Vercel Hobby rejects schedules more often than daily). Its own Supabase
project and its own Vercel project; nothing is shared with Flake.

Never run `pnpm seed:demo` against anything real people use (it refuses anything that isn't localhost anyway).

## 1. GitHub

A repo under 216LABS (private unless you decide otherwise), pushed from this folder.

## 2. Supabase project

Create a project named `tree-ops` (US region). **Free plan limit:** an organization gets 2 active free projects. If
Flake and 216LEADS already use both, either put this in another organization or upgrade.

Then from this folder:

```sh
pnpm db:link --project-ref <ref>
pnpm db:push
```

`db:push` applies the three migrations: schema, row level security plus the storage buckets, and the shared reference
rows (species list, verified pre-work rules).

In **Authentication**:
- **URL Configuration:** Site URL `https://tree.216labs.dev`; redirect URLs `https://tree.216labs.dev/**`.
- **Providers, Email:** turn **Confirm email off**. Sign-in is email and password with no emails sent (the text-only
  rule); with confirmation on, a new company's sign-up would wait for an email that never matters.

In the **SQL editor**, add the two Vault secrets (values never committed):

```sql
select vault.create_secret('https://tree.216labs.dev', 'app_base_url', 'Public origin of the web app');
select vault.create_secret('<paste CRON_SECRET>', 'cron_secret', 'Bearer token for /api/cron routes');
```

Then schedule the background jobs, using the **direct** connection (port 5432, or the session pooler on 5432 on an
IPv4 network):

```sh
DATABASE_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' pnpm db:schedule
```

| Job | When | Calls |
|---|---|---|
| `treeops-jobs` | every 2 minutes | `/api/cron/jobs` (texts, retries) |
| `treeops-daily` | 09:00 UTC (5 AM Eastern) | `/api/cron/daily` (weather for the week, expire estimates and links) |
| `treeops-prune-log` | 03:30 UTC | clears old cron logs |

## 3. Vercel

Import the GitHub repo as a new project (`tree-ops`). Root Directory `apps/web`; turn on **Include source files outside
of the Root Directory**; framework Next.js. Vercel picks up pnpm from the lockfile.

Environment variables (Production):

| Name | Value |
|---|---|
| `APP_ENV`, `NEXT_PUBLIC_APP_ENV` | `production` |
| `PROVIDERS_MODE` | `live` |
| `APP_BASE_URL` | `https://tree.216labs.dev` (same as Vault `app_base_url`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
| `DATABASE_URL` | the **transaction pooler** URL, port 6543 |
| `DB_POOL_MAX` | `3` |
| `CRON_SECRET` | `openssl rand -hex 32`, same as Vault `cron_secret` |
| `LINK_TOKEN_SECRET` | `openssl rand -hex 32`. Never change it after launch: it fingerprints every crew, customer and claim link |
| `NWS_USER_AGENT` | `(tree.216labs.dev, <contact email>)` (NOAA asks for a contact) |

Leave Stripe and Twilio unset for now: production refuses mock providers, so card payments and texts simply say they
aren't set up yet, and the office uses "Text it from my phone" links and records checks by hand.

## 4. The domain

In the Vercel project, **Settings, Domains**, add `tree.216labs.dev`. Where 216labs.dev's DNS lives:
- If it's on Vercel (as `flake.216labs.dev` may be), the subdomain works right away.
- Otherwise add the CNAME record Vercel shows (`tree` pointing at `cname.vercel-dns.com`).

## 5. First sign-in

Open `https://tree.216labs.dev/login`, choose **New company? Start here**, and go through setup. That account is the
owner. Add sales arborists and office staff in Settings, Sign-ins.

To show it to Davey with demo data, use a separate preview deployment with its own Supabase project and
`DEMO_LOGIN=1`. Don't seed the real one.

## Turning on payments and texts later

- **Stripe Connect** (test mode first): set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (webhook to
  `https://tree.216labs.dev/api/webhooks/stripe`, events `checkout.session.completed` and `account.updated`, on both
  the platform and Connect endpoints).
- **Twilio:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (a verified toll-free number), and the inbound
  webhook `https://tree.216labs.dev/api/webhooks/twilio` for STOP/HELP/START.

Both paths are written but haven't run against the real services yet ([T] in the spec).
