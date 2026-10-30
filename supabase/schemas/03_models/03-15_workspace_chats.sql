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
