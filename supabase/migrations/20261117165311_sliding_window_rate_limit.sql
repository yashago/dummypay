-- -----------------------------------------------------------------------------
-- Sliding-window rate limiting
--
-- The phase 3 version counted hits per clock-aligned window
-- (floor(now / window)), so a burst straddling a window boundary could make up
-- to twice the limit within a few seconds. This version logs every allowed hit
-- and counts those in the trailing p_window, so the limit holds over ANY
-- window-length interval.
--
-- hit_rate_limit keeps its signature, so lookup_recipient (20/min) and
-- create_transfer_quote (30/min) need no changes. Rejected calls still don't
-- count: the RATE_LIMITED exception rolls the whole call back.
-- -----------------------------------------------------------------------------

create table public.rate_limit_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  action     text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_user_action_time_idx
  on public.rate_limit_events (user_id, action, created_at);
revoke all on public.rate_limit_events from anon, authenticated;
alter table public.rate_limit_events enable row level security;  -- no policies: internal only

create or replace function public.hit_rate_limit(p_user uuid, p_action text, p_limit integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  -- Serialize concurrent calls for the same user and action: otherwise two
  -- requests could both count limit-1 hits and both get through. Under READ
  -- COMMITTED the count below runs after the lock is granted, so it sees the
  -- hit committed by the call that held the lock.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_action, 0));

  -- Hits that have left the window will never count again.
  delete from public.rate_limit_events
   where user_id = p_user and action = p_action and created_at <= now() - p_window;

  select count(*) into v_hits
    from public.rate_limit_events
   where user_id = p_user and action = p_action and created_at > now() - p_window;

  if v_hits >= p_limit then
    raise exception 'RATE_LIMITED: too many % requests, try again shortly', p_action;
  end if;

  insert into public.rate_limit_events (user_id, action) values (p_user, p_action);
end;
$$;

-- `create or replace` keeps the existing privileges (internal only); restate
-- them so this migration is self-describing.
revoke all on function public.hit_rate_limit(uuid, text, integer, interval) from public, anon, authenticated;

drop table public.rate_limits;
