# House Build Tracker — App Spec
Client: Relative (24eggs / construction — owner-builder tracking his own house build)
Prepared by: Restea Automation | Draft for confirmation

---

## 1. Concept

A phase-based cost and task tracker for a single owner-builder managing their own house construction. Tracks subcontractors, tasks, and costs per phase (Foundation, Framing, Plumbing, Electrical, Land Purchase, etc.), attaches supporting files/receipts, and rolls everything up into a final profit report (best offer − total cost).

Single-user tool (no sub-facing access in v1). Built in the Restea Automation "workshop ledger" theme so it can double as a demo on the company site later.

---

## 2. Phases

- Fully custom — user creates, names, and orders phases freely. No fixed list, no locked sequence.
- Examples: Land Purchase, Foundation, Framing, Plumbing, Electrical, Roofing, Drywall, Finishing.
- Realtor for the land purchase is entered as a subcontractor under a "Land Purchase" phase.
- Each phase has a **checkbox to mark it complete/closed.**
- Each phase has two sections: **Subcontractors** and **Tasks** — plus a phase-level running cost total.

---

## 3. Subcontractor section (per phase)

**Adding:** `+` button adds a new sub to that phase.

**Fields per sub:**
- Name
- Company
- Phone number
- Bid price (all-inclusive — one lump figure covering the full scope of that sub's work)

**Favorite:** Star icon marks a sub as a favorite — **scoped to that phase only.** The same sub can exist in multiple phases (e.g. same electrician does rough-in and final) and can be favorited in one phase without being favorited in another.

**Completion / payment:**
- Checkbox marks the sub as checked off/done.
- Checking it prompts for **amount actually paid** (not the bid — this covers underpayment for incomplete or bad work).
- That paid amount **counts toward phase cost immediately**, no receipt required.
- If a receipt is later attached to that sub and confirmed, the receipt's extracted amount **overrides** the manually-entered paid amount in the cost total.

**Change orders:**
- `+` button on a sub to add a change order — additional scope/amount tied to that same sub within that phase (e.g. original framing bid + a storage unit addition).
- Tracked as an addition to that sub's record, not a separate sub entry.

---

## 4. Task section (per phase)

**Adding:** `+` button adds a new task to that phase.

**Fields per task:**
- Priority: High / Medium / Low
- Target date
- Completed date
- Price (optional — some tasks have no cost, e.g. "call Bob")

**Completion:**
- Checkbox marks task complete → prompts for completed date.

**Sorting:**
- Sort by priority or by price.
- Manual drag-to-reorder is also available — dragging sets a new saved manual order, which persists until the user picks a different sort mode.

**Cost logic:**
- If a task has a price entered, it **counts toward phase cost immediately** upon entry — no need to wait for a receipt.
- If a receipt is later attached to that task and confirmed, the receipt's amount **overrides** the entered price.
- Tasks with no price never contribute to cost.

---

## 5. Cost rule (unified — applies to both subs and tasks)

> **The manually-entered number is the default source of truth. A confirmed receipt is an override, not a gate.**

- Sub paid amount → counts the moment it's entered at checkbox-completion.
- Task price → counts the moment it's entered.
- Receipts are optional verification/correction, not a requirement — since checks sent to subs often aren't photographed.
- If a receipt is attached and confirmed later, its extracted amount replaces the manual figure in the running total.

---

## 6. Files

**Attachment:** Any sub or any task can have files attached — receipts, photos, plans, drawings, checks, etc.

**Receipt auto-extraction:**
- On upload of a standard receipt, attempt to auto-extract **date, vendor, amount.**
- Extracted values are shown to the user for **confirm/edit before** they count toward or override the cost total — never applied silently, since OCR can misread amounts.

**Metadata per file:** date added, which phase it was added under.

**All Files view:** a separate, flat, global view of every file across the whole project, sorted **newest-added first.** No folder-by-phase structure required — just the flat list.

---

## 7. Final report

- Triggered once the user considers the project done (phases can be individually checked complete, but the report can be run whenever).
- **Total cost** = sum of all phase costs (paid sub amounts + change orders + task costs, receipt-overridden where applicable) across **all phases, including Land Purchase.**
- **Best offer** = one number, entered by the user (the accepted/best sale offer on the house).
- **Profit = Best offer − Total cost.**
- Report is a simple summary: total cost, best offer, profit — not a multi-scenario model in v1.

---

## 8. Explicitly out of scope (v1)

- No sub-facing login or access — subs never interact with the tool directly. Flagged for possible future development.
- No enforced phase sequencing/locking.
- No multi-offer profit modeling — one best-offer number only.
- No receipt requirement to count a cost — receipts only override.

---

## 9. Build phasing

**V1 — Core tracker (no AI extraction yet):**
- Custom phases with complete checkbox
- Subs: add, favorite (per-phase), edit, checkbox-complete with paid amount, change orders
- Tasks: add, priority/date/price fields, checkbox-complete with completed date, sort by priority/price, manual drag order
- File upload and attachment to subs/tasks, manual entry of date/vendor/amount (no auto-extract yet)
- All Files global view, newest-first
- Running phase cost totals
- Final report: total cost vs. best offer → profit

**V2 — Receipt auto-extraction:**
- OCR/AI extraction of date/vendor/amount from uploaded receipts
- Confirm/edit step before the extracted value overrides the manual entry
- Built once V1's data model and real usage patterns are proven out

---

## 10. Tech & theme

- Stack: Next.js, Vercel, GitHub — same pattern as the egg app and ARV tool.
- Styled in the **Restea Automation "workshop ledger" theme** (kraft/ink/route-green/rust/amber palette, Barlow Semi Condensed + Source Serif 4 + IBM Plex Mono) so it can later serve as a demo on resteaautomation.com.
- Single-user auth (no sub access in v1) — likely simplest is a basic password/login gate rather than full multi-user auth, TBD when we scope the technical build.

---

## 11. Still open (non-blocking)

- Whether the final report locks/requires all phases to be checked complete first, or can be run at any time regardless of phase status. (Current assumption: can be run any time — user's call on timing.)

---

*Once confirmed, this becomes the working reference for the Claude Code build. Update as decisions change during the build.*
