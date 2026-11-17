-- =============================================================================
-- DummyPay — Phase 5: simulated payment cards & bank accounts
--
-- * Nothing here is connected to a processor or bank.
-- * Full card numbers and CVVs are NEVER stored: there are no columns for
--   them. The add-payment-card Edge Function validates the full number/CVV in
--   memory and inserts only brand, last four digits and expiry.
-- * Bank account numbers / IBANs are stored masked only.
-- * Inserts happen only through the Edge Functions (service role, after
--   verifying the caller's JWT). Users may read and delete their own rows.
-- =============================================================================

create table public.payment_cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  cardholder_name   text not null check (char_length(cardholder_name) between 2 and 100),
  card_brand        text not null check (card_brand in ('visa', 'mastercard', 'amex', 'discover', 'other')),
  last_four_digits  char(4) not null check (last_four_digits ~ '^[0-9]{4}$'),
  expiration_month  smallint not null check (expiration_month between 1 and 12),
  expiration_year   smallint not null check (expiration_year between 2000 and 2100),
  mock_card_token   text not null unique check (mock_card_token ~ '^tok_sim_[A-Za-z0-9]{24}$'),
  created_at        timestamptz not null default now()
);
create index payment_cards_user_idx on public.payment_cards (user_id, created_at desc);

create table public.bank_accounts (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references public.profiles (id) on delete cascade,
  account_holder_name        text not null check (char_length(account_holder_name) between 2 and 100),
  bank_name                  text not null check (char_length(bank_name) between 2 and 100),
  country                    char(2) not null check (country ~ '^[A-Z]{2}$'),
  currency                   public.currency_code not null,
  identifier_type            text not null check (identifier_type in ('iban', 'account_number')),
  -- e.g. "IL•• •••• 9999" or "•••• 6789" — never the full identifier.
  masked_account_identifier  text not null
                             check (masked_account_identifier ~ '^([A-Z]{2}•• )?•••• [0-9A-Z]{4}$'),
  created_at                 timestamptz not null default now()
);
create index bank_accounts_user_idx on public.bank_accounts (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Privileges & RLS
-- -----------------------------------------------------------------------------
revoke all on public.payment_cards from anon, authenticated;
revoke all on public.bank_accounts from anon, authenticated;
grant select, delete on public.payment_cards to authenticated;
grant select, delete on public.bank_accounts to authenticated;

alter table public.payment_cards enable row level security;
alter table public.bank_accounts enable row level security;

create policy "Users read their own cards"
  on public.payment_cards for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users delete their own cards"
  on public.payment_cards for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Users read their own bank accounts"
  on public.bank_accounts for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users delete their own bank accounts"
  on public.bank_accounts for delete to authenticated
  using (user_id = (select auth.uid()));
