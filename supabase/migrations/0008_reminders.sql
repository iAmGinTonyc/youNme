-- Tracks whether the "3 hours before" reminder has gone out for a
-- booking, so the periodic reminder job doesn't send it twice.
alter table bookings add column reminder_sent_at timestamptz;
