-- Lets the master tap a booker's name to open a chat with them in Telegram.
-- Nullable: older bookings and users without a @username stay unclickable.
alter table bookings add column model_username text;
