-- Change orders the sub's paid amount already covers.
--
-- Checking a sub off asks for one all-in figure: the main order and every change
-- order standing at that moment. But those change orders kept the empty tick box
-- 0003 gave them, reading "not in total" — which was false, and an invitation to
-- tick it and add money the paid figure had already counted. Once for the
-- projection, once for the tick: the same change order in the phase total twice.
--
-- This is the flag the settlement writes on them. A covered change order shows
-- as settled with nothing to tick; only scope raised *after* that figure was
-- entered keeps the box, which is what `is_paid` was always for.
--
-- Re-entering a paid amount covers everything again, for the same reason it
-- clears `is_paid`: the new figure is all-in as of now.
alter table public.change_orders
  add column if not exists is_covered boolean not null default false;

-- Subs already checked off. Anything not ticked as paid on top was, by the rule
-- above, inside that figure. Nothing here moves a total either way — both states
-- add nothing on top — it only stops the row claiming it was left out.
update public.change_orders co
   set is_covered = true
  from public.subcontractors s
 where s.id = co.subcontractor_id
   and s.is_complete
   and not co.is_paid
   and not co.is_covered;
