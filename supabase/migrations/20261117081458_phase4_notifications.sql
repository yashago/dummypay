-- =============================================================================
-- DummyPay — Phase 4: real-time notifications
--
-- * A notification is written by an AFTER INSERT trigger on transactions, so
--   it is part of the transfer's own database transaction: it exists if and
--   only if the transfer committed.
-- * Supabase Realtime streams committed changes from the WAL and applies RLS
--   per subscriber, so users only ever receive their own rows.
-- =============================================================================

create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  transaction_id      uuid not null references public.transactions (id) on delete cascade,
  kind                text not null default 'payment_received' check (kind in ('payment_received')),
  title               text not null,
  message             text not null,
  -- Structured copy of the key facts so the UI can format them itself.
  sender_display_name text not null,
  sender_email        extensions.citext not null,
  amount_minor        bigint not null check (amount_minor > 0),
  currency            public.currency_code not null,
  is_read             boolean not null default false,
  read_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (user_id, transaction_id)
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx  on public.notifications (user_id) where not is_read;

-- -----------------------------------------------------------------------------
-- Money formatting for notification text (e.g. "$1,234.50").
-- -----------------------------------------------------------------------------
create function public.format_money(p_minor bigint, p_currency public.currency_code)
returns text
language sql
stable
set search_path = ''
as $$
  select sc.symbol || to_char(p_minor / power(10, sc.minor_units)::numeric, 'FM999,999,999,999,990.00')
    from public.supported_currencies sc
   where sc.code = p_currency
$$;

-- -----------------------------------------------------------------------------
-- Trigger: notify the recipient of every completed transfer.
-- -----------------------------------------------------------------------------
create function public.notify_transfer_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'transfer' and new.status = 'completed' then
    insert into public.notifications
      (user_id, transaction_id, title, message,
       sender_display_name, sender_email, amount_minor, currency)
    values
      (new.recipient_user_id, new.id,
       'Payment received',
       format('%s (%s) sent you %s.',
              new.sender_display_name, new.sender_email,
              public.format_money(new.receiving_amount_minor, new.receiving_currency)),
       new.sender_display_name, new.sender_email,
       new.receiving_amount_minor, new.receiving_currency);
  end if;
  return null;
end;
$$;

create trigger transactions_notify_recipient
  after insert on public.transactions
  for each row execute function public.notify_transfer_recipient();

-- -----------------------------------------------------------------------------
-- Reading & marking as read
-- -----------------------------------------------------------------------------
create function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := public.require_user();
  v_count integer;
begin
  update public.notifications
     set is_read = true, read_at = now()
   where user_id = v_uid
     and not is_read
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges & RLS: users may only read their own notifications; all writes
-- go through the trigger or mark_notifications_read.
-- -----------------------------------------------------------------------------
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

alter table public.notifications enable row level security;
create policy "Users read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on function public.format_money(bigint, public.currency_code) from public, anon, authenticated;
revoke all on function public.notify_transfer_recipient()                from public, anon, authenticated;
revoke all on function public.mark_notifications_read(uuid[])            from public, anon, authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: stream new notifications and balance changes (RLS-filtered).
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications, public.wallets;
