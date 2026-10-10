-- Two saves by the same user at the same moment could both read the same max(number) and
-- collide on unique (user_id, number). A per-user transaction-scoped advisory lock makes them
-- take turns; the lock is released automatically at commit or rollback.

create or replace function public.assign_brief_number() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select coalesce(max(b.number), 0) + 1 into new.number
  from public.briefs b
  where b.user_id = new.user_id;
  return new;
end;
$$;
