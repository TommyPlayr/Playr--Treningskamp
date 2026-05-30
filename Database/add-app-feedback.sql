create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  email text,
  contact_name text,
  team_name text,
  age_group text,
  category text not null check (category in ('bug', 'forbedring', 'funksjon', 'annet')),
  message text not null check (char_length(trim(message)) > 0),
  screen text,
  created_at timestamptz not null default now()
);

alter table public.app_feedback enable row level security;

drop policy if exists "Users can create their own feedback" on public.app_feedback;

create policy "Users can create their own feedback"
on public.app_feedback
for insert
to authenticated
with check (auth.uid() = user_id);