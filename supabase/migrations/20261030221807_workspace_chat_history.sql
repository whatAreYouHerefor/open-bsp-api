-- Generated from the new workspace_chats declarative schemas.
-- Private internal assistant history, never a customer-facing conversation.
create table public.workspace_chats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  turns jsonb not null default '[]'::jsonb check (
    jsonb_typeof(turns) = 'array' and jsonb_array_length(turns) <= 100
    and octet_length(turns::text) <= 1048576
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_chats_user_org_updated on public.workspace_chats(user_id, organization_id, updated_at desc);
create trigger set_workspace_chat_updated_at before update on public.workspace_chats
for each row execute function public.moddatetime('updated_at');

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
