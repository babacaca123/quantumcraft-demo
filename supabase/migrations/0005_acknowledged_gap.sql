-- The receipt-vs-entered gap the user has already looked at and waved through.
--
-- Confirmed receipts are the total for a sub — the bid, the change orders, the
-- lot. So when they disagree with what was entered by hand, the row says so,
-- because the difference is either a receipt that was misread or money nobody
-- has accounted for. Neither is something to bury.
--
-- Sometimes it is neither, and the answer is simply "yes, I know". That is what
-- this records: the exact gap that was dismissed, not the fact of a dismissal.
-- Move either figure and the gap changes, the dismissal no longer matches it,
-- and the warning comes back — which is the point. A boolean would have hidden
-- every mismatch on that sub forever after the first shrug.
alter table public.subcontractors
  add column if not exists acknowledged_gap numeric(12, 2);
