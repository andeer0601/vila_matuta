begin;
alter table meal_purchases add column checkout_expires_at timestamptz;
alter table meal_purchases add column checkout_single_payment boolean not null default false;
-- Old links deliberately remain unverified; never recreate them automatically.
commit;
