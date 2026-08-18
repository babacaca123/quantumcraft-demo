-- House Build Tracker — initial schema
-- Run this in the Supabase SQL editor (or `supabase db push`) against a fresh project.
--
-- Design notes:
--   * Single-user tool. Every row carries user_id and RLS restricts it to auth.uid().
--   * Cost rule (spec §5): the manually-entered number is the source of truth; a
--     confirmed receipt overrides it. Nothing here enforces that — it lives in
--     lib/costs.ts so the rule reads in one place — but the columns it needs are
--     attachments.is_confirmed and attachments.amount.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- projects
-- One row per house build. v1 only ever creates one, but keeping the table
-- means best_offer has a home and a second build is not a migration.
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'House Build',
  best_offer  numeric(12, 2),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- phases
create table if not exists public.phases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null,
  position    integer not null default 0,
  is_complete boolean not null default false,
  -- persisted task sort mode for this phase: manual order survives until the
  -- user picks a different mode (spec §4).
  task_sort   text not null default 'manual'
                check (task_sort in ('manual', 'priority', 'price')),
  created_at  timestamptz not null default now()
);
create index if not exists phases_project_idx on public.phases (project_id, position);

-- ---------------------------------------------------------------- subcontractors
-- A sub is scoped to a phase. The same person appearing in two phases is two
-- rows, which is what makes per-phase favouriting work (spec §3).
create table if not exists public.subcontractors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  phase_id    uuid not null references public.phases (id) on delete cascade,
  name        text not null,
  company     text,
  phone       text,
  bid_price   numeric(12, 2),
  is_favorite boolean not null default false,
  is_complete boolean not null default false,
  paid_amount numeric(12, 2),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists subs_phase_idx on public.subcontractors (phase_id, position);

-- ---------------------------------------------------------------- change orders
-- Extra scope tied to an existing sub, not a separate sub entry (spec §3).
create table if not exists public.change_orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  subcontractor_id  uuid not null references public.subcontractors (id) on delete cascade,
  description       text not null,
  amount            numeric(12, 2) not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists change_orders_sub_idx on public.change_orders (subcontractor_id, created_at);

-- ---------------------------------------------------------------- tasks
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  phase_id       uuid not null references public.phases (id) on delete cascade,
  title          text not null,
  priority       text not null default 'medium'
                   check (priority in ('high', 'medium', 'low')),
  target_date    date,
  completed_date date,
  price          numeric(12, 2),
  is_complete    boolean not null default false,
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists tasks_phase_idx on public.tasks (phase_id, position);

-- ---------------------------------------------------------------- attachments
-- Files hang off a sub or a task. Exactly one owner, enforced below.
-- phase_id is denormalised so the All Files view (spec §6) can label a file
-- with its phase without walking two joins.
create table if not exists public.attachments (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  project_id        uuid not null references public.projects (id) on delete cascade,
  phase_id          uuid not null references public.phases (id) on delete cascade,
  subcontractor_id  uuid references public.subcontractors (id) on delete cascade,
  task_id           uuid references public.tasks (id) on delete cascade,
  storage_path      text not null,
  file_name         text not null,
  mime_type         text,
  size_bytes        bigint,
  -- receipt fields. In v1 these are typed in by hand; v2 pre-fills them by
  -- extraction. Either way is_confirmed gates whether amount overrides cost.
  receipt_date      date,
  vendor            text,
  amount            numeric(12, 2),
  is_confirmed      boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint attachments_one_owner check (
    (subcontractor_id is not null) <> (task_id is not null)
  ),
  -- a confirmed receipt must actually carry an amount to override with
  constraint attachments_confirmed_needs_amount check (
    not is_confirmed or amount is not null
  )
);
create index if not exists attachments_recent_idx on public.attachments (user_id, created_at desc);
create index if not exists attachments_sub_idx on public.attachments (subcontractor_id);
create index if not exists attachments_task_idx on public.attachments (task_id);

-- ---------------------------------------------------------------- RLS
alter table public.projects       enable row level security;
alter table public.phases         enable row level security;
alter table public.subcontractors enable row level security;
alter table public.change_orders  enable row level security;
alter table public.tasks          enable row level security;
alter table public.attachments    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'projects', 'phases', 'subcontractors', 'change_orders', 'tasks', 'attachments'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------- storage
-- Private bucket; objects are keyed <user_id>/<uuid>-<filename> so the owner
-- check is a path-prefix comparison.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments_owner_read"   on storage.objects;
drop policy if exists "attachments_owner_insert" on storage.objects;
drop policy if exists "attachments_owner_update" on storage.objects;
drop policy if exists "attachments_owner_delete" on storage.objects;

create policy "attachments_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "attachments_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
