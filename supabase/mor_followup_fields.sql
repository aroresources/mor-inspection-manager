-- Follow-up response tracking on MORs, used by the unified MOR status.
-- When a Contract Administrator rejects part of a response, check "follow_up"
-- and a follow-up response due date / submitted date drive the status.
--
-- Run this in the Supabase SQL Editor.

alter table mors add column if not exists follow_up boolean not null default false;
alter table mors add column if not exists follow_up_response_due_date date;
alter table mors add column if not exists follow_up_response_submitted_date date;
