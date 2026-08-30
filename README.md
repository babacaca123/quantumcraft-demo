# House Build Tracker

A phase-based cost and task tracker for a single owner-builder managing their own
house build. Tracks subcontractors, tasks and costs per phase, attaches receipts
and files, and rolls everything up into a profit report.

Built to [`construction-tracker-spec.md`](./construction-tracker-spec.md) (V1) in the
Restea Automation "workshop ledger" theme, so it can double as a demo on
resteaautomation.com later.

**Stack:** Next.js 16 (App Router, Server Actions) · Supabase (Postgres + Storage +
Auth) · Vercel.

---

## The one rule worth knowing

> The manually-entered number is the default source of truth.
> A confirmed receipt is an override, not a gate.

A sub's paid amount and a task's price count toward the phase total the moment you
type them — no receipt required, because checks mailed to subs rarely get
photographed. If you later attach a receipt and tick **confirmed**, its amount
replaces the hand-entered figure. Unconfirmed receipts never count.

**A subcontractor costs:**

| State | Cost counted |
| --- | --- |
| Not yet paid | bid **+ every change order** — a projection |
| Marked paid | the paid amount **+ any change order ticked paid since** |

Change orders stack on top of the main order, which is the whole point of them.
But the figure entered when checking a sub off is what was actually handed over
for the entire job, change orders included — so they stop stacking at that point
rather than being billed twice.

Scope raised *after* that settlement is genuinely extra, so each change order on
a settled sub carries a **paid** checkbox that adds it on top. Re-entering the
paid amount clears every one of those ticks, because the new figure is all-in
again.

Favourited subs pin to the top of their phase's list; everything else keeps its
saved order underneath.

Both rules live in one place: [`lib/costs.ts`](./lib/costs.ts).

---

## Setup

### 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the migrations in `supabase/migrations/` in order:
   - [`0001_init.sql`](./supabase/migrations/0001_init.sql) — every table, RLS
     scoped to `auth.uid()`, and the private `attachments` storage bucket with
     matching policies.
   - [`0002_receipts.sql`](./supabase/migrations/0002_receipts.sql) — adds
     `attachments.is_receipt`, so only a receipt carries a price.
   - [`0003_change_order_paid.sql`](./supabase/migrations/0003_change_order_paid.sql)
     — adds `change_orders.is_paid`, for scope raised after a sub was settled.
   - [`0004_change_order_covered.sql`](./supabase/migrations/0004_change_order_covered.sql)
     — adds `change_orders.is_covered`, for scope the paid amount already
     covers, so it cannot also be ticked on top of it.
3. Under **Authentication → Users**, add the single user account (email +
   password). Under **Authentication → Sign In / Providers**, disable sign-ups —
   this is a single-user tool and there is no registration screen.

### 2. Point the app at it

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key |

The anon key is safe in the browser — RLS is what protects the data.

One more, from the [Anthropic Console](https://console.anthropic.com/settings/keys):

| Variable | What it does |
| --- | --- |
| `ANTHROPIC_API_KEY` | Reads date, vendor and amount off an uploaded receipt |

It is read server-side only, in `/api/extract-receipt`, and never reaches the
browser. Leave it out and everything still works — the receipt form just opens
blank for you to fill in by hand.

### 3. Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

### 4. Deploy to Vercel

Not yet deployed. From a clean checkout:

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add ANTHROPIC_API_KEY production
vercel --prod
```

Or import the GitHub repo in the Vercel dashboard and add the same two variables
under **Settings → Environment Variables**. No build configuration is needed.

---

## How it is laid out

```
app/
  (app)/                   authenticated shell — nav, footer, session check
    page.tsx               phase list, drag to reorder, running totals
    phases/[id]/page.tsx   one phase: subcontractors + tasks
    files/page.tsx         All Files, flat and newest-first
    report/page.tsx        total cost vs best offer -> profit
  login/                   single-user password gate
  actions/                 every server action (auth, tracker, files)
lib/
  costs.ts                 the cost rule + currency/date formatting
  data.ts                  queries; loads the whole build in one round trip
  types.ts                 row types
  supabase/                browser client, server client, session refresh
components/                theme chrome, dialogs, sortable rows, feature sections
supabase/migrations/       schema, RLS, storage policies
proxy.ts                   session refresh + auth redirect on every request
```

Data access goes through Supabase's client with RLS on every table, so an
authenticated request can only ever see its own rows. Files live in a private
bucket keyed `<user id>/<uuid>-<filename>`; the app hands out one-hour signed
URLs rather than making anything public.

---

## Theme

Ported from [`restea-theme-sample.html`](./restea-theme-sample.html) into
[`app/globals.css`](./app/globals.css). The tokens and core conventions carry over
unchanged so the app reads as the same system as the marketing site:

- **Every control is outlined.** Inline actions are bordered chips, not bare
  text, so a row of them reads as buttons rather than stray words.
- **Palette:** kraft `#EDE6D6` / kraft-deep `#E3DAC4` / ink `#232323` /
  route `#3F6B4F` / route-deep `#2E5039` / rust `#B5502E` / slate `#5C6660` /
  amber `#E8B93F`
- **Type:** Barlow Semi Condensed (display, uppercase, tracked out) · Source Serif 4
  (body and headings) · IBM Plex Mono (every number, date and piece of metadata)
- **Conventions reused as-is:** `.wrap`, `.eyebrow`, `.btn` / `.btn.ghost`,
  `.ledger-row` for list items, the inverted ink stat strip for totals, and the
  hand-drawn divider rule.

Numbers are always mono, labels are always uppercase display, prose is always
serif. New components (`.item`, `.filetile`, `.badge`, dialogs, form controls)
follow those same three rules.

Files show themselves rather than just naming themselves: images render a real
thumbnail from their signed URL, everything else gets a tile carrying its
extension. **All Files** is a grid of those tiles — click one for the metadata,
the receipt amount and the actions.

---

## Receipt auto-extraction (spec §6)

Tick **This is a receipt** on upload and the details dialog opens already
reading the file. `/api/extract-receipt` fetches the bytes from Storage
server-side — the browser only ever sends an attachment id — and asks Claude
Haiku 4.5 for the date, the vendor and the grand total. Anything illegible comes
back null rather than guessed.

The result only fills the form in. Nothing counts toward a cost until you tick
**confirmed** yourself.

Confirming writes nothing back onto the sub or the task. `paid_amount` and
`price` keep whatever you typed, and `lib/costs.ts` decides at display time which
figure counts — the confirmed-receipt total when there is one, the hand-entered
figure otherwise (spec §5). Where the two disagree the row shows both: the
receipt total counting, the entered figure struck through beside it. Unconfirm or
delete a receipt and it simply drops out of the sum.

Two things it works around: HEIC, which nothing but the browser can decode, is
converted to a JPEG client-side before it is sent; and a failed read is never a
failed upload — the file is already saved, and the form simply opens blank.

---

## What is not in V1

Per spec §8 and §9, deliberately out of scope:

- No sub-facing login. Subs never touch the tool.
- No enforced phase sequencing or locking.
- No multi-offer profit modelling — one best-offer number.

## Still open

Spec §11: whether the final report should require every phase to be checked
complete first. Built on the current assumption — it runs at any time, and flags
how many phases are still open.
