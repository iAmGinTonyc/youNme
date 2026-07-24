alter table bookings add column master_confirmed_at timestamptz;
alter table bookings add column client_confirmed_at timestamptz;
