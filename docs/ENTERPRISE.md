# Enterprise setup (Davey pilot)

What a pilot in one district needs, and where it stands.

## Single sign-on [T]

1. In Supabase (the enterprise's own project), turn on SAML SSO and add the company's identity provider (Okta or Azure
   AD) with `supabase sso add --type saml --metadata-url <IdP metadata> --domains <company domain>`.
2. In Tree Ops, Settings, Company: set "Single sign-on email domain" to that domain.
3. People sign in with "Company single sign-on" on the login page. Their first sign-in lands on setup unless the owner
   added their email under Settings, Sign-ins first, so add the pilot users there with their role.

Not yet tested against a real identity provider.

## Own database

Deploy the same code to a separate Supabase project and Vercel project for the enterprise, run the migrations, and set
its environment variables. Nothing in the code is shared between tenants across projects.

## Security answers (draft)

- Tenant isolation: row level security on every table, tested in `packages/db/test/rls.test.ts`; plus an own database
  on request.
- Audit: every change to hand-edited records is logged with who and when (`audit_log`, append-only), viewable and
  exportable by the owner and enterprise admin.
- Field records (photos, signatures, briefings, confirmations, payments, treatment records) can't be edited or deleted,
  even by the server; corrections are separate records.
- Export: any table as CSV from Settings, Export.
- Subprocessors: Supabase, Vercel, Stripe, Twilio. US region.
- Not yet: penetration test, MFA enforcement settings, written incident and retention policies.
