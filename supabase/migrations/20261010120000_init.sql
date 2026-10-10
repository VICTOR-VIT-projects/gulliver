-- Gulliver: a user's roster of acts and their saved tour briefs.
--
-- Guests sign in anonymously and get the `authenticated` role like everyone else,
-- so no policy here grants anything to "any authenticated user". Every policy
-- compares user_id to auth.uid(); shared briefs are reachable only through
-- shared_brief(slug), never through a table policy that could be listed.

-- Roster ----------------------------------------------------------------------

create table public.roster (
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  act_id    text not null check (act_id ~ '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$'),
  name      text not null check (char_length(name) between 1 and 200),
  kind      text not null check (kind in ('artist', 'comedian')),
  image_url text check (image_url is null or image_url ~ '^https://'),
  added_at  timestamptz not null default now(),
  primary key (user_id, act_id)
);

alter table public.roster enable row level security;

create policy "roster: owner reads" on public.roster
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "roster: owner adds" on public.roster
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "roster: owner removes" on public.roster
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Briefs ----------------------------------------------------------------------

create table public.briefs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number     integer not null,
  act_id     text not null check (act_id ~ '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$'),
  act_name   text not null check (char_length(act_name) between 1 and 200),
  payload    jsonb not null check (pg_column_size(payload) < 1000000),
  share_slug text unique check (share_slug is null or share_slug ~ '^[A-Za-z0-9_-]{22,64}$'),
  created_at timestamptz not null default now(),
  unique (user_id, number)
);

create index briefs_user_created on public.briefs (user_id, created_at desc);

alter table public.briefs enable row level security;

create policy "briefs: owner reads" on public.briefs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "briefs: owner adds" on public.briefs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "briefs: owner shares" on public.briefs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "briefs: owner removes" on public.briefs
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Per-user running number ("No. 014"). The client can't choose it. Two inserts
-- racing for the same user hit the unique constraint, and the second one retries.
create function public.assign_brief_number() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select coalesce(max(b.number), 0) + 1 into new.number
  from public.briefs b
  where b.user_id = new.user_id;
  return new;
end;
$$;

create trigger briefs_assign_number
  before insert on public.briefs
  for each row execute function public.assign_brief_number();

-- Grants: explicit, so nothing depends on the project's default privileges.
-- The only column an owner can change after saving is share_slug.

revoke all on public.roster, public.briefs from anon, authenticated;
grant select, insert, delete on public.roster to authenticated;
grant select, insert, delete on public.briefs to authenticated;
grant update (share_slug) on public.briefs to authenticated;

-- Sharing ---------------------------------------------------------------------

-- Read one shared brief by its unguessable slug. No user_id or brief id leaves the database.
create function public.shared_brief(slug text)
returns table (number integer, act_id text, act_name text, payload jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.number, b.act_id, b.act_name, b.payload, b.created_at
  from public.briefs b
  where b.share_slug = slug;
$$;

revoke all on function public.shared_brief(text) from public;
grant execute on function public.shared_brief(text) to anon, authenticated;

-- Account deletion ----------------------------------------------------------

-- Deletes the caller's auth user; roster and briefs go with it (on delete cascade).
create function public.delete_my_account() returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
