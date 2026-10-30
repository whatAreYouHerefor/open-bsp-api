alter table public.workspace_chats enable row level security;
revoke all on public.workspace_chats from anon, authenticated;
grant select, insert on public.workspace_chats to authenticated;
-- Identity and tenant cannot be changed after creation.
grant update (title, turns) on public.workspace_chats to authenticated;

create policy "read own internal chats while a member" on public.workspace_chats
for select to authenticated
using (user_id = (select auth.uid()) and organization_id in (select public.get_authorized_orgs('member')));
create policy "create own internal chats while a member" on public.workspace_chats
for insert to authenticated
with check (user_id = (select auth.uid()) and organization_id in (select public.get_authorized_orgs('member')));
create policy "update own internal chats while a member" on public.workspace_chats
for update to authenticated
using (user_id = (select auth.uid()) and organization_id in (select public.get_authorized_orgs('member')))
with check (user_id = (select auth.uid()) and organization_id in (select public.get_authorized_orgs('member')));
