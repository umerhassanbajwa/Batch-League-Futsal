-- Batch 2025 League: database schema and security rules.
-- Paste this whole file into Supabase > SQL Editor > New query, then Run.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  grp text not null check (grp in ('A','B','C','D')),
  created_at timestamptz not null default now()
);
create unique index if not exists teams_name_unique on public.teams (lower(name));

create table if not exists public.matches (
  id text primary key default gen_random_uuid()::text,
  stage text not null check (stage in ('group','qf','sf','final')),
  grp text check (grp in ('A','B','C','D')),
  matchday int not null default 1,
  sort_order int not null default 0,
  slot_n int,
  home text not null,
  away text not null,
  hg int check (hg between 0 and 99),
  ag int check (ag between 0 and 99),
  ph int check (ph between 0 and 99),
  pa int check (pa between 0 and 99),
  played boolean not null default false,
  match_date date,
  created_at timestamptz not null default now()
);
-- A pair can only be scheduled once per group, so a double click can never create duplicates.
create unique index if not exists matches_group_pair_unique on public.matches (stage, grp, home, away);

-- Organisers: emails listed here may change data. Everyone else can only read.
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;
-- No policies on admins: nobody can read or write it through the API.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.teams enable row level security;
alter table public.matches enable row level security;

drop policy if exists "teams are public" on public.teams;
create policy "teams are public" on public.teams for select using (true);
drop policy if exists "organisers change teams" on public.teams;
create policy "organisers change teams" on public.teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "matches are public" on public.matches;
create policy "matches are public" on public.matches for select using (true);
drop policy if exists "organisers change matches" on public.matches;
create policy "organisers change matches" on public.matches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Live updates: the site refreshes itself when an organiser saves a score.
-- Safe to run more than once: it skips tables that are already in the list.
do $$
begin
  begin
    alter publication supabase_realtime add table public.teams;
  exception when duplicate_object or undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.matches;
  exception when duplicate_object or undefined_object then null;
  end;
end $$;

-- Add yourself as an organiser (replace the email, then run just this line):
-- insert into public.admins (email) values ('you@example.com');
