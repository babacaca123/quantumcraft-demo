-- Files are not receipts by default.
--
-- v1 originally put date/vendor/amount on every upload, which implied every
-- file carried a price. Only a receipt does. `is_receipt` is what v2's
-- extraction step will set automatically; in v1 the user ticks it on upload.
alter table public.attachments
  add column if not exists is_receipt boolean not null default false;

-- Anything already carrying an amount was a receipt by definition.
update public.attachments
   set is_receipt = true
 where amount is not null
   and is_receipt = false;

-- A price only ever belongs to a receipt.
alter table public.attachments
  drop constraint if exists attachments_amount_needs_receipt;
alter table public.attachments
  add constraint attachments_amount_needs_receipt
  check (amount is null or is_receipt);
