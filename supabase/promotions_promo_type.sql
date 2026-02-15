-- Add promo_type for promotions styling + tracking
-- Values: sponsor | internal | affiliate

begin;

alter table public.promotions
  add column if not exists promo_type text;

update public.promotions
set promo_type = coalesce(promo_type, 'sponsor');

alter table public.promotions
  alter column promo_type set default 'sponsor';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'promotions_promo_type_check'
  ) then
    alter table public.promotions
      add constraint promotions_promo_type_check
      check (promo_type in ('sponsor','internal','affiliate'));
  end if;
end $$;

commit;

