-- =============================================================================
-- DummyPay — Phase 6: hardening
--
-- Shrink the SECURITY DEFINER surface (Supabase advisor lint 0029). Functions
-- that only read data the caller may already see now run as SECURITY INVOKER,
-- so RLS applies to them directly. The remaining definer functions are the
-- deliberate, audited entry points that must write money tables or look up
-- other users:
--   add_wallet, set_preferred_currency, lookup_recipient,
--   create_transfer_quote, execute_transfer, mark_notifications_read
-- Each one derives identity from auth.uid() and never from its arguments.
-- =============================================================================

-- Pure helpers used by the invoker functions below. They expose nothing that a
-- signed-in user can't already read (fx_rates is readable by authenticated).
alter function public.fx_rate(public.currency_code, public.currency_code) security invoker;

grant execute on function public.fx_rate(public.currency_code, public.currency_code) to authenticated;
grant execute on function public.fx_max_age()                                       to authenticated;
grant execute on function public.convert_minor(bigint, numeric, public.amount_side)  to authenticated;
grant execute on function public.require_user()                                     to authenticated;

-- Read-only user operations → caller's privileges + RLS.
alter function public.preview_conversion(bigint, public.currency_code, public.currency_code, public.amount_side)
  security invoker;
alter function public.get_wallet_summary() security invoker;
