-- =============================================================================
-- DummyPay — Phase 3: peer-to-peer transfers & transaction history
--
-- Flow:  lookup_recipient(email)            → minimal recipient info
--        create_transfer_quote(...)         → server-priced quote, valid 60s
--        execute_transfer(quote, idem_key)  → one atomic transaction
--
-- Concurrency: the quote row and both wallets are locked FOR UPDATE (wallets
-- in id order, so two opposite transfers can't deadlock). Balances also have
-- CHECK (balance_minor >= 0) as a last line of defence.
-- Idempotency: UNIQUE (sender_user_id, idempotency_key) + quote_id UNIQUE; a
-- repeated request returns the original transaction instead of moving money.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Snapshot of both parties on each transaction (history must not change later,
-- and users cannot read each other's profiles).
-- -----------------------------------------------------------------------------
alter table public.transactions
  add column sender_display_name    text,
  add column sender_email           extensions.citext,
  add column recipient_display_name text,
  add column recipient_email        extensions.citext;

-- Backfill existing initial grants (immutability trigger paused for this one-off).
alter table public.transactions disable trigger transactions_immutable;
update public.transactions t
   set recipient_display_name = p.display_name,
       recipient_email        = p.email
  from public.profiles p
 where p.id = t.recipient_user_id;
alter table public.transactions enable trigger transactions_immutable;

alter table public.transactions
  alter column recipient_display_name set not null,
  alter column recipient_email        set not null,
  add constraint transactions_sender_snapshot_chk check (
    (type = 'initial_grant' and sender_display_name is null and sender_email is null)
    or (type = 'transfer' and sender_display_name is not null and sender_email is not null)
  );

-- Sign-up trigger now records the snapshot on the welcome credit too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  v_currency_raw text := new.raw_user_meta_data ->> 'preferred_currency';
  v_currency     public.currency_code;
  v_grant        bigint;
  v_wallet_id    uuid;
begin
  if new.email is null then
    raise exception 'EMAIL_REQUIRED' using errcode = '22023';
  end if;

  if char_length(v_display_name) not between 2 and 50 then
    raise exception 'INVALID_DISPLAY_NAME' using errcode = '22023';
  end if;

  select sc.code, sc.initial_grant_minor
    into v_currency, v_grant
    from public.supported_currencies sc
   where sc.code::text = v_currency_raw;

  if not found then
    raise exception 'INVALID_CURRENCY' using errcode = '22023';
  end if;

  insert into public.profiles (id, email, display_name, preferred_currency)
  values (new.id, new.email, v_display_name, v_currency);

  insert into public.wallets (user_id, currency, balance_minor)
  values (new.id, v_currency, v_grant)
  returning id into v_wallet_id;

  insert into public.transactions
    (type, status, recipient_user_id, recipient_wallet_id, receiving_amount_minor,
     receiving_currency, recipient_display_name, recipient_email)
  values
    ('initial_grant', 'completed', new.id, v_wallet_id, v_grant,
     v_currency, v_display_name, new.email);

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Rate limiting (fixed windows per user and action)
-- -----------------------------------------------------------------------------
create table public.rate_limits (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  action       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (user_id, action, window_start)
);
revoke all on public.rate_limits from anon, authenticated;
alter table public.rate_limits enable row level security;  -- no policies: internal only

create function public.hit_rate_limit(p_user uuid, p_action text, p_limit integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
  v_hits integer;
begin
  insert into public.rate_limits (user_id, action, window_start, hits)
  values (p_user, p_action, v_window, 1)
  on conflict (user_id, action, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  if v_hits > p_limit then
    raise exception 'RATE_LIMITED: too many % requests, try again shortly', p_action;
  end if;

  -- Opportunistic cleanup of old windows for this user.
  delete from public.rate_limits
   where user_id = p_user and action = p_action and window_start < now() - interval '1 day';
end;
$$;

-- -----------------------------------------------------------------------------
-- Recipient lookup
-- Returns a status instead of raising for not-found/self so that the rate-limit
-- hit is committed even for unsuccessful probes.
-- -----------------------------------------------------------------------------
create function public.lookup_recipient(p_email text)
returns table (
  status             text,              -- 'found' | 'not_found' | 'self'
  user_id            uuid,
  display_name       text,
  email              text,
  preferred_currency public.currency_code
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := public.require_user();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_row   public.profiles;
begin
  if char_length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL: enter a valid email address';
  end if;

  perform public.hit_rate_limit(v_uid, 'lookup_recipient', 20, interval '1 minute');

  select * into v_row from public.profiles p where p.email = v_email::extensions.citext;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::text, null::public.currency_code;
  elsif v_row.id = v_uid then
    return query select 'self'::text, null::uuid, null::text, null::text, null::public.currency_code;
  else
    return query select 'found'::text, v_row.id, v_row.display_name, v_row.email::text, v_row.preferred_currency;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Quotes
-- -----------------------------------------------------------------------------
create table public.transfer_quotes (
  id                        uuid primary key default gen_random_uuid(),
  sender_user_id            uuid not null references public.profiles (id) on delete cascade,
  recipient_user_id         uuid not null references public.profiles (id) on delete cascade,
  sending_currency          public.currency_code not null,
  receiving_currency        public.currency_code not null,
  sending_amount_minor      bigint not null check (sending_amount_minor > 0),
  receiving_amount_minor    bigint not null check (receiving_amount_minor > 0),
  amount_input_side         public.amount_side not null,
  exchange_rate             numeric(20, 10) not null check (exchange_rate > 0),
  rate_provider             text not null,
  rate_provider_updated_at  timestamptz not null,
  created_at                timestamptz not null default now(),
  expires_at                timestamptz not null,
  consumed_at               timestamptz,
  check (sender_user_id <> recipient_user_id)
);
create index transfer_quotes_sender_idx on public.transfer_quotes (sender_user_id, created_at desc);

revoke all on public.transfer_quotes from anon, authenticated;
grant select on public.transfer_quotes to authenticated;
alter table public.transfer_quotes enable row level security;
create policy "Senders read their own quotes"
  on public.transfer_quotes for select to authenticated
  using (sender_user_id = (select auth.uid()));

alter table public.transactions
  add constraint transactions_quote_id_fkey
  -- Quotes are only deleted with an account; SET NULL would be an UPDATE, which
  -- the immutability trigger forbids, so follow the same cascade as profiles.
  foreign key (quote_id) references public.transfer_quotes (id) on delete cascade;

-- Shape returned to clients for quotes (includes recipient display info).
create type public.transfer_quote_view as (
  quote_id                 uuid,
  recipient_user_id        uuid,
  recipient_display_name   text,
  recipient_email          text,
  sending_currency         public.currency_code,
  receiving_currency       public.currency_code,
  sending_amount_minor     bigint,
  receiving_amount_minor   bigint,
  amount_input_side        public.amount_side,
  exchange_rate            numeric,
  rate_provider_updated_at timestamptz,
  expires_at               timestamptz
);

create function public.create_transfer_quote(
  p_recipient_id     uuid,
  p_sending_currency public.currency_code,
  p_amount_minor     bigint,
  p_input_side       public.amount_side
)
returns public.transfer_quote_view
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := public.require_user();
  v_recipient  public.profiles;
  v_balance    bigint;
  v_rate       numeric;
  v_rate_at    timestamptz;
  v_provider   text;
  v_computed   bigint;
  v_send       bigint;
  v_receive    bigint;
  v_quote      public.transfer_quotes;
begin
  if p_recipient_id is null then
    raise exception 'RECIPIENT_NOT_FOUND';
  end if;
  if p_recipient_id = v_uid then
    raise exception 'SELF_TRANSFER: you cannot send money to yourself';
  end if;
  if p_sending_currency is null or p_input_side is null then
    raise exception 'INVALID_CURRENCY';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 100000000 then
    raise exception 'INVALID_AMOUNT: amount must be between 0.01 and 1,000,000.00';
  end if;

  select * into v_recipient from public.profiles where id = p_recipient_id;
  if not found then
    raise exception 'RECIPIENT_NOT_FOUND';
  end if;

  select balance_minor into v_balance
    from public.wallets
   where user_id = v_uid and currency = p_sending_currency;
  if not found then
    raise exception 'NO_WALLET: you have no % wallet', p_sending_currency;
  end if;

  select r.rate, r.provider_updated_at, r.provider into v_rate, v_rate_at, v_provider
    from public.fx_rate(p_sending_currency, v_recipient.preferred_currency) r;
  if v_rate is null or v_rate <= 0 then
    raise exception 'RATE_UNAVAILABLE';
  end if;
  if v_rate_at < now() - public.fx_max_age() then
    raise exception 'RATE_STALE';
  end if;

  v_computed := public.convert_minor(p_amount_minor, v_rate, p_input_side);
  if v_computed < 1 then
    raise exception 'INVALID_AMOUNT: amount is too small to convert';
  end if;

  if p_input_side = 'send' then
    v_send := p_amount_minor;  v_receive := v_computed;
  else
    v_send := v_computed;      v_receive := p_amount_minor;
  end if;

  -- Early, friendly check. The authoritative check happens under lock at execution.
  if v_send > v_balance then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  perform public.hit_rate_limit(v_uid, 'create_transfer_quote', 30, interval '1 minute');

  insert into public.transfer_quotes
    (sender_user_id, recipient_user_id, sending_currency, receiving_currency,
     sending_amount_minor, receiving_amount_minor, amount_input_side,
     exchange_rate, rate_provider, rate_provider_updated_at, expires_at)
  values
    (v_uid, p_recipient_id, p_sending_currency, v_recipient.preferred_currency,
     v_send, v_receive, p_input_side,
     v_rate, v_provider, v_rate_at, now() + interval '60 seconds')
  returning * into v_quote;

  return row(
    v_quote.id, v_recipient.id, v_recipient.display_name, v_recipient.email::text,
    v_quote.sending_currency, v_quote.receiving_currency,
    v_quote.sending_amount_minor, v_quote.receiving_amount_minor, v_quote.amount_input_side,
    v_quote.exchange_rate, v_quote.rate_provider_updated_at, v_quote.expires_at
  )::public.transfer_quote_view;
end;
$$;

-- -----------------------------------------------------------------------------
-- Execution — the only code path that moves money between users.
-- -----------------------------------------------------------------------------
create function public.execute_transfer(p_quote_id uuid, p_idempotency_key uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid              uuid := public.require_user();
  v_existing         public.transactions;
  v_quote            public.transfer_quotes;
  v_sender           public.profiles;
  v_recipient        public.profiles;
  v_sender_wallet    public.wallets;
  v_recipient_wallet uuid;
  v_txn              public.transactions;
begin
  if p_quote_id is null or p_idempotency_key is null then
    raise exception 'INVALID_REQUEST: quote and idempotency key are required';
  end if;

  -- 1. Replay of a completed request → return the original result.
  select * into v_existing from public.transactions
   where sender_user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.quote_id is distinct from p_quote_id then
      raise exception 'IDEMPOTENCY_CONFLICT: this request key was already used for another transfer';
    end if;
    return v_existing;
  end if;

  -- 2. Lock the quote (serialises concurrent attempts on the same quote).
  select * into v_quote from public.transfer_quotes
   where id = p_quote_id and sender_user_id = v_uid
   for update;
  if not found then
    raise exception 'QUOTE_NOT_FOUND';
  end if;

  if v_quote.consumed_at is not null then
    -- A concurrent duplicate may have just completed it with this same key.
    select * into v_existing from public.transactions
     where quote_id = p_quote_id and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
    raise exception 'QUOTE_USED: this quote has already been used';
  end if;
  if v_quote.expires_at < now() then
    raise exception 'QUOTE_EXPIRED: the quote has expired, please review the transfer again';
  end if;

  select * into v_sender    from public.profiles where id = v_uid;
  select * into v_recipient from public.profiles where id = v_quote.recipient_user_id;
  if v_recipient.id is null then
    raise exception 'RECIPIENT_NOT_FOUND';
  end if;

  -- 3. Make sure the recipient has a wallet in the receiving currency.
  insert into public.wallets (user_id, currency, balance_minor)
  values (v_recipient.id, v_quote.receiving_currency, 0)
  on conflict (user_id, currency) do nothing;

  select id into v_recipient_wallet from public.wallets
   where user_id = v_recipient.id and currency = v_quote.receiving_currency;

  select * into v_sender_wallet from public.wallets
   where user_id = v_uid and currency = v_quote.sending_currency;
  if v_sender_wallet.id is null then
    raise exception 'NO_WALLET';
  end if;

  -- 4. Lock both wallets in a consistent order (prevents deadlocks).
  perform 1 from public.wallets
   where id in (v_sender_wallet.id, v_recipient_wallet)
   order by id
   for update;

  -- Re-read the sender balance under the lock.
  select * into v_sender_wallet from public.wallets where id = v_sender_wallet.id;
  if v_sender_wallet.balance_minor < v_quote.sending_amount_minor then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  -- 5. Move the money and record it — all or nothing.
  update public.wallets
     set balance_minor = balance_minor - v_quote.sending_amount_minor
   where id = v_sender_wallet.id;

  update public.wallets
     set balance_minor = balance_minor + v_quote.receiving_amount_minor
   where id = v_recipient_wallet;

  begin
    insert into public.transactions (
      type, status,
      sender_user_id, recipient_user_id, sender_wallet_id, recipient_wallet_id,
      sending_amount_minor, sending_currency, receiving_amount_minor, receiving_currency,
      exchange_rate, amount_input_side, quote_id, rate_provider, rate_provider_updated_at,
      idempotency_key,
      sender_display_name, sender_email, recipient_display_name, recipient_email
    ) values (
      'transfer', 'completed',
      v_uid, v_recipient.id, v_sender_wallet.id, v_recipient_wallet,
      v_quote.sending_amount_minor, v_quote.sending_currency,
      v_quote.receiving_amount_minor, v_quote.receiving_currency,
      v_quote.exchange_rate, v_quote.amount_input_side, v_quote.id,
      v_quote.rate_provider, v_quote.rate_provider_updated_at,
      p_idempotency_key,
      v_sender.display_name, v_sender.email, v_recipient.display_name, v_recipient.email
    )
    returning * into v_txn;
  exception when unique_violation then
    -- Same key raced in with a different quote: the other request won.
    raise exception 'IDEMPOTENCY_CONFLICT: this request key was already used for another transfer';
  end;

  update public.transfer_quotes set consumed_at = now() where id = v_quote.id;

  return v_txn;
end;
$$;

-- -----------------------------------------------------------------------------
-- History (security invoker → RLS limits rows to the caller's transactions)
-- -----------------------------------------------------------------------------
create function public.list_my_transactions(
  p_direction text default null,                 -- 'sent' | 'received' | null
  p_currency  public.currency_code default null, -- the caller's side of the transaction
  p_from      timestamptz default null,
  p_to        timestamptz default null,
  p_limit     integer default 20,
  p_offset    integer default 0
)
returns table (
  id                       uuid,
  created_at               timestamptz,
  type                     public.txn_type,
  status                   public.txn_status,
  direction                text,
  sender_user_id           uuid,
  sender_display_name      text,
  sender_email             text,
  recipient_user_id        uuid,
  recipient_display_name   text,
  recipient_email          text,
  sending_amount_minor     bigint,
  sending_currency         public.currency_code,
  receiving_amount_minor   bigint,
  receiving_currency       public.currency_code,
  exchange_rate            numeric,
  amount_input_side        public.amount_side,
  rate_provider_updated_at timestamptz,
  total_count              bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select t.*,
           case when t.sender_user_id = auth.uid() then 'sent' else 'received' end as dir
      from public.transactions t
     where auth.uid() in (t.sender_user_id, t.recipient_user_id)
  )
  select m.id, m.created_at, m.type, m.status, m.dir,
         m.sender_user_id, m.sender_display_name, m.sender_email::text,
         m.recipient_user_id, m.recipient_display_name, m.recipient_email::text,
         m.sending_amount_minor, m.sending_currency,
         m.receiving_amount_minor, m.receiving_currency,
         m.exchange_rate, m.amount_input_side, m.rate_provider_updated_at,
         count(*) over ()
    from mine m
   where (p_direction is null or m.dir = p_direction)
     and (p_currency is null
          or (m.dir = 'sent' and m.sending_currency = p_currency)
          or (m.dir = 'received' and m.receiving_currency = p_currency))
     and (p_from is null or m.created_at >= p_from)
     and (p_to is null or m.created_at < p_to)
   order by m.created_at desc, m.id
   limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- -----------------------------------------------------------------------------
-- Function privileges
-- -----------------------------------------------------------------------------
revoke all on function public.hit_rate_limit(uuid, text, integer, interval) from public, anon, authenticated;
revoke all on function public.lookup_recipient(text) from public, anon, authenticated;
revoke all on function public.create_transfer_quote(uuid, public.currency_code, bigint, public.amount_side) from public, anon, authenticated;
revoke all on function public.execute_transfer(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_my_transactions(text, public.currency_code, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;

grant execute on function public.lookup_recipient(text) to authenticated;
grant execute on function public.create_transfer_quote(uuid, public.currency_code, bigint, public.amount_side) to authenticated;
grant execute on function public.execute_transfer(uuid, uuid) to authenticated;
grant execute on function public.list_my_transactions(text, public.currency_code, timestamptz, timestamptz, integer, integer) to authenticated;

-- handle_new_user was replaced: keep it non-callable.
revoke all on function public.handle_new_user() from public, anon, authenticated;
