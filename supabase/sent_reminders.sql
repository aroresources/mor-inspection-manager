-- Tracks which deadline reminders have already been sent, so the daily cron
-- (app/api/send-reminders/route.ts) doesn't re-send the same reminder type for
-- the same MOR more than once per week.
--
-- Run this manually in the Supabase SQL Editor.

create table sent_reminders (
  id uuid default gen_random_uuid() primary key,
  mor_id uuid references mors(id) on delete cascade,
  reminder_type text not null,
  sent_at timestamp default now()
);

GRANT ALL ON sent_reminders TO anon, authenticated;
