-- Supabase's default privileges grant EXECUTE on every new public function to anon
-- explicitly, so `revoke ... from public` in the init migration didn't remove it.
-- scripts/rls-check.ts caught a signed-out caller reaching delete_my_account(). It deleted
-- nothing (auth.uid() is null), but signed-out callers shouldn't reach it at all.

revoke execute on function public.delete_my_account() from anon;
revoke execute on function public.assign_brief_number() from anon, authenticated;

-- Also state the signed-in requirement in the query itself rather than relying on NULL comparison.
create or replace function public.delete_my_account() returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where auth.uid() is not null and id = auth.uid();
$$;
