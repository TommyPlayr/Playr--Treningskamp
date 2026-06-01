create table if not exists public.match_confirmation_sms_log (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  request_id uuid not null references public.match_requests(id) on delete cascade,
  phone text not null,
  recipient_role text not null check (recipient_role in ('host', 'away')),
  sent_at timestamptz not null default now(),
  twilio_sid text,
  error text
);

create unique index if not exists match_confirmation_sms_once_idx
  on public.match_confirmation_sms_log (request_id, phone);

alter table public.match_confirmation_sms_log enable row level security;