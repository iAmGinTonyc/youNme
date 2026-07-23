-- Roles are data, not infrastructure: presence in `masters` is what makes
-- a Telegram user a master. Everyone else is treated as a model/client.
create table masters (
  telegram_id bigint primary key,
  name text,
  created_at timestamptz not null default now()
);

create type slot_status as enum ('open', 'booked', 'cancelled', 'completed');

create table slots (
  id uuid primary key default gen_random_uuid(),
  master_id bigint not null references masters(telegram_id),
  starts_at timestamptz not null,
  duration_minutes int not null,
  location text,
  note text,
  deposit_amount int, -- Telegram Stars, unused until payments land
  status slot_status not null default 'open',
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references slots(id),
  model_telegram_id bigint not null,
  model_name text,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled_by_model', 'cancelled_by_master', 'no_show', 'completed')),
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

-- Only one active (confirmed) booking per slot at a time.
create unique index bookings_one_active_per_slot
  on bookings (slot_id)
  where status = 'confirmed';

-- The append-only log that turns "he said / she said" into a fact both
-- sides can point to. Never updated or deleted, only inserted into.
create table events (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid references slots(id),
  booking_id uuid references bookings(id),
  actor_telegram_id bigint,
  actor_role text,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

-- RLS is enabled with zero policies on purpose: the anon key can read
-- and write nothing directly. All access goes through Edge Functions
-- using the service role key, which independently verifies Telegram
-- initData on every call. This is defense in depth, not the primary
-- authorization mechanism.
alter table masters enable row level security;
alter table slots enable row level security;
alter table bookings enable row level security;
alter table events enable row level security;
