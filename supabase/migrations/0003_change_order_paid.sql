-- A change order raised *after* a sub has been paid off.
--
-- The paid amount is all-in for everything that existed when it was entered, so
-- change orders stop stacking on top of it. That left later change orders with
-- no way into the total short of unchecking the sub and rechecking it. This flag
-- is that way in: tick it once the extra scope has been paid for too, and it
-- adds on top of the paid figure.
--
-- Change orders already covered by the paid amount stay false, which is why
-- re-entering a paid amount resets every flag on that sub — the new figure is
-- all-in again.
alter table public.change_orders
  add column if not exists is_paid boolean not null default false;
