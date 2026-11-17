-- =============================================================================
-- DummyPay — Phase 1: foundation
-- Profiles, wallets, transactions, initial-grant sign-up trigger, RLS, grants.
--
-- Security model (see plan §4):
--   * Postgres is the only authority over money. Clients get SELECT only on
--     money tables; every write goes through SECURITY DEFINER functions.
--   * Identity always comes from auth.uid(); no function trusts a user id arg.
--   * All money is stored as bigint minor units (agorot, cents, pence).
-- =============================================================================

create extension if not exists citext with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.currency_code as enum ('ILS', 'USD', 'EUR', 'GBP');
create type public.txn_type      as enum ('initial_grant', 'transfer');
create type public.txn_status    as enum ('completed');
create type public.amount_side   as enum ('send', 'receive');

-- -----------------------------------------------------------------------------
-- Supported currencies (reference data; the initial grant amount is data, not code)
-- -----------------------------------------------------------------------------
create table public.supported_currencies (
  code                 public.currency_code primary key,
  name                 text     not null,
  symbol               text     not null,
  minor_units          smallint not null default 2 check (minor_units between 0 and 4),
  initial_grant_minor  bigint   not null check (initial_grant_minor >= 0)
);

insert into public.supported_currencies (code, name, symbol, minor_units, initial_grant_minor) values
  ('ILS', 'Israeli Shekel', '₪', 2, 1300000),  -- 13,000.00
  ('USD', 'US Dollar',      '$', 2,  500000),  --  5,000.00
  ('EUR', 'Euro',           '€', 2,  500000),
  ('GBP', 'British Pound',  '£', 2,  500000);

-- -----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users; credentials stay in Supabase Auth)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               extensions.citext not null unique,
  display_name        text not null
                      check (char_length(display_name) between 2 and 50
                             and display_name = btrim(display_name)),
  preferred_currency  public.currency_code not null references public.supported_currencies (code),
  created_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Wallets (one per user per currency)
-- -----------------------------------------------------------------------------
create table public.wallets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  currency       public.currency_code not null references public.supported_currencies (code),
  balance_minor  bigint not null default 0 check (balance_minor >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, currency)
);

create index wallets_user_id_idx on public.wallets (user_id);

-- -----------------------------------------------------------------------------
-- Transactions (immutable ledger of every balance change)
--   initial_grant: recipient side only.
--   transfer:      both sides, rate and idempotency key (populated from Phase 3).
-- -----------------------------------------------------------------------------
create table public.transactions (
  id                        uuid primary key default gen_random_uuid(),
  type                      public.txn_type   not null,
  status                    public.txn_status not null default 'completed',
  sender_user_id            uuid references public.profiles (id) on delete cascade,
  recipient_user_id         uuid not null references public.profiles (id) on delete cascade,
  sender_wallet_id          uuid references public.wallets (id) on delete cascade,
  recipient_wallet_id       uuid not null references public.wallets (id) on delete cascade,
  sending_amount_minor      bigint check (sending_amount_minor > 0),
  sending_currency          public.currency_code,
  receiving_amount_minor    bigint not null check (receiving_amount_minor > 0),
  receiving_currency        public.currency_code not null,
  exchange_rate             numeric(20, 10) check (exchange_rate > 0),
  amount_input_side         public.amount_side,
  quote_id                  uuid unique,          -- FK added in Phase 3 (transfer_quotes)
  rate_provider             text,
  rate_provider_updated_at  timestamptz,
  idempotency_key           uuid,
  created_at                timestamptz not null default now(),

  unique (sender_user_id, idempotency_key),

  constraint transactions_shape_chk check (
    (
      type = 'initial_grant'
      and sender_user_id is null and sender_wallet_id is null
      and sending_amount_minor is null and sending_currency is null
      and exchange_rate is null and amount_input_side is null
      and quote_id is null and idempotency_key is null
    )
    or
    (
      type = 'transfer'
      and sender_user_id is not null and sender_wallet_id is not null
      and sending_amount_minor is not null and sending_currency is not null
      and exchange_rate is not null and amount_input_side is not null
      and idempotency_key is not null
      and sender_user_id <> recipient_user_id
    )
  )
);

create index transactions_sender_created_idx    on public.transactions (sender_user_id, created_at desc);
create index transactions_recipient_created_idx on public.transactions (recipient_user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Trigger functions
-- -----------------------------------------------------------------------------

-- Historical transactions must never change (spec §6). UPDATE is always
-- rejected. DELETE is rejected unless it is a foreign-key cascade from an
-- account being deleted by an administrator (pg_trigger_depth() > 1).
create function public.prevent_transaction_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'TRANSACTION_IMMUTABLE: transactions cannot be modified or deleted'
    using errcode = '42501';
end;
$$;

create trigger transactions_immutable
  before update or delete on public.transactions
  for each row execute function public.prevent_transaction_mutation();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger wallets_touch_updated_at
  before update on public.wallets
  for each row execute function public.touch_updated_at();

-- Sign-up: create profile + preferred-currency wallet + initial grant, atomically
-- with the auth.users insert. Runs exactly once per account, so the grant can
-- never be claimed twice. Invalid metadata aborts the whole sign-up.
create function public.handle_new_user()
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
    (type, status, recipient_user_id, recipient_wallet_id, receiving_amount_minor, receiving_currency)
  values
    ('initial_grant', 'completed', new.id, v_wallet_id, v_grant, v_currency);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync if Auth ever changes a user's email.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email and new.email is not null)
  execute function public.handle_user_email_change();

-- Trigger functions are not callable by API roles.
revoke all on function public.prevent_transaction_mutation() from public, anon, authenticated;
revoke all on function public.touch_updated_at()            from public, anon, authenticated;
revoke all on function public.handle_new_user()             from public, anon, authenticated;
revoke all on function public.handle_user_email_change()    from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privileges: start from nothing, grant the minimum.
-- -----------------------------------------------------------------------------
revoke all on public.supported_currencies from anon, authenticated;
revoke all on public.profiles             from anon, authenticated;
revoke all on public.wallets              from anon, authenticated;
revoke all on public.transactions         from anon, authenticated;

grant select on public.supported_currencies to anon, authenticated;  -- needed on the sign-up form
grant select on public.profiles             to authenticated;
grant update (display_name) on public.profiles to authenticated;     -- only editable column
grant select on public.wallets              to authenticated;        -- no client writes, ever
grant select on public.transactions         to authenticated;        -- no client writes, ever

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.supported_currencies enable row level security;
alter table public.profiles             enable row level security;
alter table public.wallets              enable row level security;
alter table public.transactions         enable row level security;

create policy "Currencies are public reference data"
  on public.supported_currencies for select
  to anon, authenticated
  using (true);

create policy "Users read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users read their own wallets"
  on public.wallets for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users read transactions they are part of"
  on public.transactions for select
  to authenticated
  using ((select auth.uid()) in (sender_user_id, recipient_user_id));
