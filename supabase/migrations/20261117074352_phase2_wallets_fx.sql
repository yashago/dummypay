-- =============================================================================
-- DummyPay — Phase 2: wallets & exchange rates
--
-- * Exchange rates come from ExchangeRate-API via the `fx-refresh` Edge
--   Function (the API key never reaches the browser). The provider returns
--   units-per-USD; cross rates are derived here in exact `numeric`.
-- * Every conversion is computed server-side with one rounding rule:
--   half-up to the nearest minor unit on the computed side.
-- * A rate is valid only if present, > 0 and its provider timestamp is at most
--   26h old (the provider's free tier publishes once a day).
-- * Errors are raised as `CODE` messages (e.g. RATE_STALE) for the client to map.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Latest provider quote per currency, expressed as units of that currency per 1 USD.
create table public.fx_rates (
  currency             public.currency_code primary key references public.supported_currencies (code),
  units_per_usd        numeric(20, 10) not null check (units_per_usd > 0),
  provider             text not null,
  provider_updated_at  timestamptz not null,
  fetched_at           timestamptz not null default now()
);

-- Append-only audit of every ingested quote.
create table public.fx_rate_history (
  id                   bigint generated always as identity primary key,
  currency             public.currency_code not null,
  units_per_usd        numeric(20, 10) not null check (units_per_usd > 0),
  provider             text not null,
  provider_updated_at  timestamptz not null,
  fetched_at           timestamptz not null default now()
);
create index fx_rate_history_currency_idx on public.fx_rate_history (currency, fetched_at desc);

-- Single-row refresh bookkeeping (throttling + last error for the UI).
create table public.fx_status (
  id               boolean primary key default true check (id),
  last_attempt_at  timestamptz,
  last_success_at  timestamptz,
  last_error       text
);
insert into public.fx_status (id) values (true);

-- -----------------------------------------------------------------------------
-- Rate maths (pure helpers)
-- -----------------------------------------------------------------------------

-- Maximum provider age for a rate to be usable in financial operations.
create function public.fx_max_age()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '26 hours' $$;

-- Cross rate from -> to (units of `to` per 1 unit of `from`), 10 decimal places.
-- Same-currency conversions use exactly 1. Returns no row if a rate is missing.
create function public.fx_rate(p_from public.currency_code, p_to public.currency_code)
returns table (rate numeric, provider_updated_at timestamptz, provider text)
language sql
stable
security definer
set search_path = ''
as $$
  select 1::numeric, now(), 'identity'::text
   where p_from = p_to
  union all
  select round(t.units_per_usd / f.units_per_usd, 10),
         least(f.provider_updated_at, t.provider_updated_at),
         f.provider
    from public.fx_rates f
    join public.fx_rates t on t.currency = p_to
   where f.currency = p_from
     and p_from <> p_to
$$;

-- Converts an amount on one side of a transfer to the other side.
--   side 'send'    : p_amount is in the sending currency   → returns receiving amount
--   side 'receive' : p_amount is in the receiving currency → returns sending amount
-- All supported currencies have 2 minor units, so minor units convert directly.
-- Postgres round(numeric) rounds half away from zero = half-up for positive amounts.
create function public.convert_minor(p_amount bigint, p_rate numeric, p_side public.amount_side)
returns bigint
language sql
immutable
strict
set search_path = ''
as $$
  select case p_side
           when 'send'    then round(p_amount::numeric * p_rate)::bigint
           when 'receive' then round(p_amount::numeric / p_rate)::bigint
         end
$$;

-- Display-only view of all cross rates (security invoker → caller's privileges).
create view public.fx_cross_rates
with (security_invoker = true)
as
select f.currency                                   as from_currency,
       t.currency                                   as to_currency,
       round(t.units_per_usd / f.units_per_usd, 10) as rate,
       least(f.provider_updated_at, t.provider_updated_at) as provider_updated_at,
       least(f.fetched_at, t.fetched_at)            as fetched_at,
       f.provider                                   as provider
  from public.fx_rates f
  join public.fx_rates t on t.currency <> f.currency;

-- -----------------------------------------------------------------------------
-- Ingestion (service role only — called by the fx-refresh Edge Function)
-- -----------------------------------------------------------------------------

-- Atomically claims a refresh slot; returns false if another refresh happened
-- within p_min_interval (protects the provider quota from repeated calls).
create function public.claim_fx_refresh(p_min_interval interval)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.fx_status
     set last_attempt_at = now()
   where id
     and (last_attempt_at is null or last_attempt_at < now() - p_min_interval)
  returning true
$$;

create function public.record_fx_failure(p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.fx_status set last_error = left(p_error, 500) where id
$$;

-- Validates and stores a provider snapshot: every supported currency must be
-- present with a positive rate, USD must be exactly 1 and the timestamp sane.
create function public.ingest_fx_rates(
  p_provider            text,
  p_provider_updated_at timestamptz,
  p_rates               jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code  public.currency_code;
  v_value numeric;
begin
  if p_provider is null or btrim(p_provider) = '' then
    raise exception 'INVALID_FX_PAYLOAD: provider required';
  end if;
  if p_provider_updated_at is null or p_provider_updated_at > now() + interval '10 minutes' then
    raise exception 'INVALID_FX_PAYLOAD: bad provider timestamp';
  end if;
  if jsonb_typeof(p_rates) is distinct from 'object' then
    raise exception 'INVALID_FX_PAYLOAD: rates must be an object';
  end if;

  -- Validate everything before writing anything.
  for v_code in select code from public.supported_currencies loop
    if jsonb_typeof(p_rates -> v_code::text) is distinct from 'number' then
      raise exception 'INVALID_FX_PAYLOAD: missing rate for %', v_code;
    end if;
    v_value := (p_rates ->> v_code::text)::numeric;
    if v_value <= 0 or v_value >= 1000000000 then
      raise exception 'INVALID_FX_PAYLOAD: rate out of range for %', v_code;
    end if;
  end loop;
  if (p_rates ->> 'USD')::numeric <> 1 then
    raise exception 'INVALID_FX_PAYLOAD: USD base rate must be 1';
  end if;

  for v_code in select code from public.supported_currencies loop
    v_value := round((p_rates ->> v_code::text)::numeric, 10);

    insert into public.fx_rates (currency, units_per_usd, provider, provider_updated_at, fetched_at)
    values (v_code, v_value, p_provider, p_provider_updated_at, now())
    on conflict (currency) do update
      set units_per_usd       = excluded.units_per_usd,
          provider            = excluded.provider,
          provider_updated_at = excluded.provider_updated_at,
          fetched_at          = excluded.fetched_at;

    insert into public.fx_rate_history (currency, units_per_usd, provider, provider_updated_at)
    values (v_code, v_value, p_provider, p_provider_updated_at);
  end loop;

  update public.fx_status
     set last_success_at = now(), last_error = null
   where id;
end;
$$;

-- -----------------------------------------------------------------------------
-- User-facing operations (identity from auth.uid(), never from arguments)
-- -----------------------------------------------------------------------------

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Server-side conversion preview. Same maths the transfer quote will use.
create function public.preview_conversion(
  p_amount_minor bigint,
  p_from         public.currency_code,
  p_to           public.currency_code,
  p_side         public.amount_side default 'send'
)
returns table (
  sending_currency        public.currency_code,
  receiving_currency      public.currency_code,
  sending_amount_minor    bigint,
  receiving_amount_minor  bigint,
  rate                    numeric,
  rate_provider_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rate     numeric;
  v_rate_at  timestamptz;
  v_computed bigint;
begin
  perform public.require_user();

  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 100000000 then
    raise exception 'INVALID_AMOUNT: amount must be between 0.01 and 1,000,000.00';
  end if;
  if p_from is null or p_to is null or p_side is null then
    raise exception 'INVALID_CURRENCY';
  end if;

  select r.rate, r.provider_updated_at into v_rate, v_rate_at
    from public.fx_rate(p_from, p_to) r;

  if v_rate is null or v_rate <= 0 then
    raise exception 'RATE_UNAVAILABLE: no exchange rate for % → %', p_from, p_to;
  end if;
  if v_rate_at < now() - public.fx_max_age() then
    raise exception 'RATE_STALE: exchange rate for % → % is out of date', p_from, p_to;
  end if;

  v_computed := public.convert_minor(p_amount_minor, v_rate, p_side);
  if v_computed < 1 then
    raise exception 'INVALID_AMOUNT: amount is too small to convert';
  end if;

  return query select
    p_from, p_to,
    case when p_side = 'send' then p_amount_minor else v_computed end,
    case when p_side = 'send' then v_computed else p_amount_minor end,
    v_rate, v_rate_at;
end;
$$;

-- Opens a new 0-balance wallet for the caller.
create function public.add_wallet(p_currency public.currency_code)
returns public.wallets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := public.require_user();
  v_wallet public.wallets;
begin
  if p_currency is null then
    raise exception 'INVALID_CURRENCY';
  end if;

  insert into public.wallets (user_id, currency, balance_minor)
  values (v_uid, p_currency, 0)
  on conflict (user_id, currency) do nothing
  returning * into v_wallet;

  if v_wallet.id is null then
    raise exception 'WALLET_EXISTS: you already have a % wallet', p_currency;
  end if;
  return v_wallet;
end;
$$;

-- Changes the caller's preferred currency. Opens a 0-balance wallet in it if
-- needed so incoming transfers always have a destination. Never grants funds.
create function public.set_preferred_currency(p_currency public.currency_code)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := public.require_user();
  v_profile public.profiles;
begin
  if p_currency is null then
    raise exception 'INVALID_CURRENCY';
  end if;

  update public.profiles set preferred_currency = p_currency
   where id = v_uid
  returning * into v_profile;

  insert into public.wallets (user_id, currency, balance_minor)
  values (v_uid, p_currency, 0)
  on conflict (user_id, currency) do nothing;

  return v_profile;
end;
$$;

-- Approximate total of all the caller's wallets in their preferred currency.
-- total_minor is null if any needed rate is missing.
create function public.get_wallet_summary()
returns table (
  preferred_currency  public.currency_code,
  total_minor         bigint,
  wallet_count        integer,
  rates_as_of         timestamptz,
  rates_stale         boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public.require_user();
  v_pref public.currency_code;
begin
  select p.preferred_currency into v_pref from public.profiles p where p.id = v_uid;

  return query
  with converted as (
    select w.balance_minor,
           r.rate,
           case when w.currency = v_pref then null else r.provider_updated_at end as rate_at
      from public.wallets w
      left join lateral public.fx_rate(w.currency, v_pref) r on true
     where w.user_id = v_uid
  )
  select v_pref,
         case when bool_and(c.rate is not null)
              then sum(round(c.balance_minor::numeric * c.rate))::bigint
         end,
         count(*)::integer,
         min(c.rate_at),
         coalesce(min(c.rate_at) < now() - public.fx_max_age(), false)
    from converted c;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on public.fx_rates        from anon, authenticated;
revoke all on public.fx_rate_history from anon, authenticated;
revoke all on public.fx_status       from anon, authenticated;
revoke all on public.fx_cross_rates  from anon, authenticated;

grant select on public.fx_rates       to authenticated;
grant select on public.fx_status      to authenticated;  -- last refresh / error for the UI
grant select on public.fx_cross_rates to authenticated;

alter table public.fx_rates        enable row level security;
alter table public.fx_rate_history enable row level security;
alter table public.fx_status       enable row level security;

create policy "Rates are readable by signed-in users"
  on public.fx_rates for select to authenticated using (true);
create policy "Refresh status is readable by signed-in users"
  on public.fx_status for select to authenticated using (true);
-- fx_rate_history: no policies → only the service role can read it.

-- Function execution: nothing is public by default.
revoke all on function public.fx_max_age()                                   from public, anon, authenticated;
revoke all on function public.fx_rate(public.currency_code, public.currency_code) from public, anon, authenticated;
revoke all on function public.convert_minor(bigint, numeric, public.amount_side)  from public, anon, authenticated;
revoke all on function public.claim_fx_refresh(interval)                     from public, anon, authenticated;
revoke all on function public.record_fx_failure(text)                        from public, anon, authenticated;
revoke all on function public.ingest_fx_rates(text, timestamptz, jsonb)      from public, anon, authenticated;
revoke all on function public.require_user()                                 from public, anon, authenticated;
revoke all on function public.preview_conversion(bigint, public.currency_code, public.currency_code, public.amount_side) from public, anon, authenticated;
revoke all on function public.add_wallet(public.currency_code)               from public, anon, authenticated;
revoke all on function public.set_preferred_currency(public.currency_code)   from public, anon, authenticated;
revoke all on function public.get_wallet_summary()                           from public, anon, authenticated;

grant execute on function public.claim_fx_refresh(interval)                to service_role;
grant execute on function public.record_fx_failure(text)                   to service_role;
grant execute on function public.ingest_fx_rates(text, timestamptz, jsonb) to service_role;

grant execute on function public.preview_conversion(bigint, public.currency_code, public.currency_code, public.amount_side) to authenticated;
grant execute on function public.add_wallet(public.currency_code)             to authenticated;
grant execute on function public.set_preferred_currency(public.currency_code) to authenticated;
grant execute on function public.get_wallet_summary()                         to authenticated;
