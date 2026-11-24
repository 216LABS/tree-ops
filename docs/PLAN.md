# Tree app: plan (draft, Nov 24, 2026)

Operations software for tree removal and tree care companies. Built from Flake. Read with `RESEARCH.md` and
`FLAKE_REUSE.md`.

## 1. Promise

"The tree you sold is the tree they cut, every crew member signed the briefing, and you have the photos if anyone
says otherwise."

## 2. Who uses it

- **Owner / district manager (buyer):** wants jobs to run to estimate, no wrong-tree or damage claims, crews safe and
  documented, and to get paid at job close.
- **Sales arborist (estimator):** walks the property, marks trees, prices, sends the estimate. Paid partly on
  commission, so speed and close rate matter. Often on a phone or tablet in a yard.
- **Office / scheduler:** builds the week around crews, equipment and weather; handles reschedules and calls.
- **Crew leader:** runs the job and the briefing. Gloves, saw dust, sun glare, weak signal.
- **Crew member / climber / sub:** needs the job, the briefing, and their hours recorded. Some speak Spanish.
- **Customer:** homeowner, HOA or property manager. Wants a clear price, to know which trees, when the crew comes, and
  a clean yard.
- **Adjuster / city / HOA (receives records):** the proof packet, a permit number, a briefing record.

## 3. v1 scope

### Must have

- **M1 Properties and trees.** Address, map with the parcel line where available, trees as numbered pins with species,
  trunk size, height, condition and photos. Hazards on the property (wires, structures, septic, soft lawn, gate width).
- **M2 Marked-tree estimate.** Lines per tree or task, each with price, crew hours, equipment and disposal. Draw on the
  photo. Optional lines the customer can tick. Sent by text link; e-sign on the marked photos; deposit by card or ACH.
- **M3 Pre-work checks.** Permit, 811 ticket with clear date and expiry, HOA approval, line clearance needed. A job
  with an open check can't be scheduled without an override that is logged.
- **M4 Schedule board.** Days by crew. A job needs N people and named equipment; equipment can't double-book. Per-job
  weather for the day (gusts, thunder, rain, heat) from NOAA, with "move these jobs" and a text to each customer. The
  office decides; nothing reschedules itself.
- **M5 Crew link.** Same no-install, offline, EN/ES app as Flake's driver link. Today's job, address, navigate, the
  marked trees, notes, gate code. Steps: property walk photos, briefing, then per tree "confirm tree" photo, before,
  after, done. Problem button. Clock in and out from the phone.
- **M6 Job briefing.** Prefilled from the estimate and checks: hazards, drop zones, lift plan if a crane is on the job,
  roles, nearest hospital, 911 address, aerial rescue plan. Each person on site signs by tapping their name on the crew
  leader's phone or their own link. Late arrivals sign on arrival. Re-brief adds a new record.
- **M7 Change orders.** Crew leader adds work on site with a price; the customer signs on the crew phone or by text.
  Nothing unsigned reaches the invoice.
- **M8 Close and bill.** At job done: invoice from the signed estimate plus change orders, less the deposit. Flags:
  tree done with no after photo, estimate line not done, done work not signed. Card on file charges, or invoice with a
  pay link. QuickBooks sync.
- **M9 Proof packet.** Per job: signed estimate with marked photos, checks, briefing signatures, property walk, every
  tree's confirm/before/after photos with times, GPS and hashes, messages, change orders, corrections.
- **M10 Customer texts.** Scheduled, weather delay with the new date, on the way, done with photos, invoice. Consent
  and STOP like Flake.

### Differentiators

- **D1 Wrong-tree guard.** The crew must take a "this is tree 3" photo at the pin before marking it started. The office
  sees a side-by-side with the estimate photo.
- **D2 Estimate vs actual.** Hours, equipment and disposal per job compared with the estimate, rolled up per
  arborist and per job type. Fix pricing with numbers.
- **D3 Weather board.** Every scheduled job's forecast for the week at a glance, with company thresholds (for example
  no climbing over 25 mph gusts, no crane over 20). Thresholds are the company's, shown as theirs, never presented as
  a safety standard.
- **D4 Storm mode.** Intake queue from a public form or the office: caller photos, danger (on house, on wire, blocking
  access), wire-down calls told to call the utility, triage order, deposit, adjuster packet.
- **D5 Free SEO tools.** Tree removal estimate template, tree service contract, job briefing form (PDF), tree removal
  cost calculator. Same play as Flake's tools; keyword volumes not checked yet.

### Later

- PHC programs: recurring routes, application records with EPA numbers and retention, record sent to customer
  (this is where Flake's route engine comes back).
- Tree inventory for HOAs and commercial properties (overlaps Davey's TreeKeeper; avoid unless asked).
- Disposal and wood tracking (dump tickets, chip drops, log sales).
- Utility line clearance (work plans, audits, utility GIS). A different market with enterprise competitors; not ours.
- Native app with background location, crane lift plans, financing offers.

## 4. Not doing

- No auto-cancel or auto-reschedule from weather. The office decides.
- No safety rule presented as a standard unless it quotes the standard. Company thresholds are labeled as the company's.
- No marketplace or lead selling.
- No fake reviews, customers or weather. Missing data shows as unavailable.
- No marketing texts. Text-only for messages, like Flake.

## 5. Pricing

Same model as Flake: free software, a percentage on payments run through it, with a Pro plan. Tree jobs average far
more than a snow push, so the per-payment cap (Flake: $25) needs a fresh look; a deposit plus final payment is two
fees. For an enterprise like Davey, a per-seat or per-crew annual price with SSO and the security review is the
expected shape; no payment fee if they keep their own processor.

## 6. The Davey question

Two different products are hiding in "Davey wants something like Flake":

1. **A tool for one Davey district office or division** (R/C or Commercial Landscape Services). Enterprise sale:
   security review, SSO, their payroll and accounting, many users, a long decision. Start with a paid pilot in one
   office on one pain (the most likely: the estimate-to-crew handoff with proof, or briefing records).
2. **A product for the many small tree companies**, sold the Flake way (free, fee on payments). Davey's interest is a
   signal the problem is real, and a pilot there would be a strong reference.

Building for (2) first, with the enterprise basics Flake already has (branches, SSO notes, security questionnaire),
keeps both open. Don't build anything Davey-specific until we know what they want.

## 7. Questions for the friend at Davey (ask before writing code)

1. Which part of Davey: residential, commercial landscape, utility, or Resource Group?
2. What problem started this? What went wrong recently that made someone say "we need software for that"?
3. What do they use today for estimates, scheduling and the crew in the field? Paper, a Davey system, a vendor?
4. Who would decide and who would pay: a district manager, a region, or corporate IT?
5. How do sales arborists hand a sold job to the crew today? Has a wrong-tree or damage claim happened?
6. How are job briefings recorded now, and has the Z133 update changed that?
7. Do crews have company phones, their own phones, or tablets? Signal in their area?
8. Would a pilot in one office for one season be possible? What would it need to clear (security, legal)?
9. Is what they saw in Flake the driver link, the proof packet, the weather side, or billing?

## 8. Open decisions

- Name. Flake is a snowflake; this needs its own, with a trademark check.
- Whether storm mode is in v1 or right after (it's the most Flake-like part and a good demo).
- Whether to fork the repo now with snow stripped out, or wait for the Davey answers. Recommendation: wait for answers
  to questions 1 to 3, since they decide whether v1 leads with estimates (small shops) or with crew handoff and
  briefings (Davey).
