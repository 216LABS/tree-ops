# Tree removal and tree care: research

Research Nov 24, 2026. Sources: ArboristSite threads, Capterra/GetApp/Software Advice listings, App Store reviews,
OSHA and ISA (ANSI Z133), TCIA's TCI Magazine, state pesticide regulators, Davey's 2025 10-K and job postings, and
news coverage of wrong-tree disputes.

**Caveats.** Reddit didn't come up in searches, and there are far fewer written reviews of tree software than of
general field-service tools. Several sources are vendor blogs (ArboStar, Jobber, QuoteIQ, BuildOps); their numbers
are not used here. The ranking below is a judgment from how often a theme came up and how costly it is when it goes
wrong, not a count. None of this has been checked with a tree company yet; the questions at the end of `PLAN.md` are
for that.

## 1. How a tree job runs

Tree work is project work, not route work. Snow is many short visits on a fixed list, triggered by weather. A tree
job is one long visit, sold one property at a time, with heavy equipment and serious risk.

1. **Lead.** Phone call, web form, referral, or a storm.
2. **Site visit.** A sales arborist (at Davey, an "Arborist Sales Representative", ISA certified) walks the property,
   decides which trees to remove, prune or treat, and judges access, hazards, equipment and hours.
3. **Estimate.** Line per tree or per task: removal, pruning, stump grinding, cabling, plant health care (PHC). Price
   rides on crew hours, equipment (crane, bucket truck, grinder, loader), access, and disposal.
4. **Approval.** Customer signs, often with a deposit on big jobs.
5. **Before the work.** Permits where the city protects trees, a utility locate (811) before stump grinding, HOA or
   neighbor sign-off, checks for nearby power lines.
6. **Scheduling.** A crew of 2 to 5 plus the right equipment on the right day. Wind, lightning, rain and heat cancel
   days; jobs run over.
7. **On site.** Job briefing (hazards, roles, rescue plan), the work, cleanup, before/after photos.
8. **Close.** Invoice, payment, follow-up (stump grinding later, PHC program, next pruning cycle).

Two other kinds of work sit beside this:

- **Plant health care (PHC):** recurring spray, injection and fertilizer visits on a schedule. This is route work, close
  to Flake. Pesticide records are required by state law.
- **Storm work:** after wind, ice or hurricanes, calls flood in, trees are on houses and lines, and insurers get
  involved. This is the closest thing tree work has to a snow storm.

## 2. Pain points (most important first)

### 1. The crew works on the wrong tree, or the estimate doesn't reach the crew

The person who sold the job is rarely the person who does it. What was agreed on site travels to the crew as a note,
flagging tape or paint.

- An arborist recounts a colleague's crew removing a street tree marked with orange tape; the client had moved the tape
  onto a tree that was meant to stay. ([tonytomeo.com](https://tonytomeo.com/2018/04/04/high-fashion/))
- A homeowner says a crew came back and cut trees when she had only asked for a quote.
  ([The Cool Down](https://www.thecooldown.com/green-home/tree-marking-company-reddit-homeowner/), unverified social post)
- Redmond, Oregon sued a tree company for removing the wrong spruce on city land.
  ([Claims Journal](https://amp.claimsjournal.com/news/west/2018/06/04/284995.htm))
- Cutting a neighbor's tree is timber trespass, which in many states allows extra damages; whether it was willful
  matters, and the burden is on proving where the tree stood. ([NPR](https://www.npr.org/2025/07/24/nx-s1-5476706/tree-disputes-timber-trespass-lawsuit-legal-expert))
- A tree company owner, on what works: "everything captured during the quoting process carries through when we convert
  that quote into a job." ([Jobber case study](https://www.getjobber.com/academy/tree-service-arborist/the-tree-lady-company/), vendor source)

**What would help:** every tree in the estimate is a numbered pin on the satellite map plus a photo with the tree
circled and the cut drawn on. The customer signs those exact pictures. The crew sees the same number, picture and pin,
and confirms "this is tree 3" with a photo before cutting. The property line, if known, shows on the map.

### 2. Estimates miss on hours, so the schedule breaks

- ArboStar calls unpredictable job durations the most common and most underestimated cause of schedule trouble.
  ([ArboStar](https://arbostar.com/education-hub/top-scheduling-problems-tree-service-companies), vendor source)
- Crane cost can swing a bid hard: one ArboristSite thread mentions an $8,000 crane bill on a $25,000 job, another a
  $215 crane on a $1,085 job. ([ArboristSite](https://arboristsite.com/threads/estimating.189278/page-2))
- "Estimates, callbacks, and 'while you're out there' stops tend to pile up." ([ArborTIMES Summer 2026](https://online.flippingbook.com/view/320409142/52/))

**What would help:** an estimate that records crew hours, equipment and disposal per line, then compares them with the
actual clock and equipment use after the job. Per arborist, over time: "your removals run 30% over."

### 3. Weather and equipment make scheduling hard

- Weather cancellations are unavoidable; the damage is losing customers because nothing reschedules them.
  ([ArboStar](https://arbostar.com/education-hub/top-scheduling-problems-tree-service-companies), vendor source)
- A tree company doubled storm capacity by scheduling "pods" (crew plus machines) instead of people and machines
  separately. ([Contractor+](https://contractorplus.app/blog/how-a-tree-care-co-doubled-storm-response-capacity), vendor case study)
- Organizing crews and equipment cut drive time to job sites. ([Vermeer](https://protips.vermeer.com/tree-care-landscape/2016/08/are-scheduling-inefficiencies-hurting-your-productivity/))
- Calendar sync was a deciding issue between ArboStar and Arborgold for one owner.
  ([ArboristSite](https://arboristsite.com/threads/what-software-should-i-use.352101/))

**What would help:** a schedule board where a job needs a crew size and specific equipment (the crane, the grinder),
and double-booking equipment is impossible. A per-job forecast of wind gusts, lightning, rain and heat for the job's
address and day, with a "move these jobs" action that texts every affected customer a new date.

### 4. Safety: briefings must happen and be verifiable

Tree work is among the most dangerous jobs in the US: BLS counted 80 tree trimmer and pruner deaths in 2023
([BLS CFOI](https://www.bls.gov/news.Release/pdf/cfoi.Pdf)). Workers' comp is expensive for the trade
([TCI Magazine](https://tcimag.tcia.org/safety/insights-into-accidents-in-tree-care/)).

- A pre-job briefing by the crew leader is required by OSHA standards and ANSI Z133.1. A written record isn't strictly
  required, but OSHA requires some verification it happened and reached every worker.
  ([OSHA](https://www.osha.gov/tree-care/safety-health-programs))
- Z133 says briefings "should be documented"; the revision expected in 2026 reportedly puts more weight on
  documentation. ([TCI Magazine, June 2026](https://tcimag.tcia.org/safety-snapshot/job-briefings-improving-documentation-and-compliance/),
  [Z133-2024 draft](https://isa-arbor.com/Portals/0/Assets/PDF/research/Z133_2024_Clean1.pdf))
- Recommended practice: the crew leader signs that the briefing was given, every crew member signs, and anyone who
  arrives later is briefed and signs. Cal/OSHA adds a re-brief when new hazards appear.
  ([TCI Magazine](https://tcimag.tcia.org/safety-snapshot/job-briefings-improving-documentation-and-compliance/),
  [Cal/OSHA](https://www.dir.ca.gov/dosh/dosh_publications/Tree-Work-fs.pdf))

**What would help:** a briefing screen on the crew link, prefilled from the estimate (power lines, structures, crane
lift, drop zones), the nearest hospital and the address for 911, and a tap-to-sign for each person on site, including
late arrivals. Stored append-only with time and GPS, so it holds up after an incident.

### 5. Property damage claims

Heavy equipment on lawns and driveways causes ruts and cracks, and customers sometimes blame the crew for damage that
was already there.

- Allstate's tree claim rules ask for at least 8 before-photos from several angles, and say access issues and
  pre-existing damage must be recorded. ([Allstate contractor doc](https://files.constantcontact.com/17b6b7ab001/5876d118-a7cf-4033-9dd8-39cca1eb86c5.pdf?rdr=true))
- Many contractors don't document the chance of collateral damage before removals.
  ([R&R Magazine](https://www.randrmagonline.com/articles/83672-don-t-be-exposed-by-tree-removal-liability))
- Documentation lowers insurance risk for tree businesses. ([Insuranceopedia](https://www.insuranceopedia.com/how-better-documentation-helps-tree-care-businesses-reduce-insurance-risk))

**What would help:** a required "property walk" set of photos before equipment moves (driveway, lawn path, fences,
structures), timestamped and hashed like Flake's visit photos, and a proof packet for any job.

### 6. Checks before work: permits, 811, power lines

- Many cities require permits for removing trees above a trunk size (Tampa: 5" DBH and up) or any street tree, and some
  require grinding to a set depth. ([Tampa](https://tampa.gov/node/33401), [Camas](https://www.cityofcamas.us/com-dev/page/tree-removal),
  [Sioux Falls](https://codelibrary.amlegal.com/codes/siouxfalls/latest/siouxfalls_sd/0-0-0-55029))
- Call 811 two full business days before grinding a stump. ([Sunshine 811](https://sunshine811.com/safe-planting))
- Charlotte notes some stumps can't be ground when utilities are present. ([Charlotte](https://www.charlottenc.gov/City-Government/Departments/General-Services/Tree-Management/Resident-Services))

**What would help:** per-job checklist items (permit number, 811 ticket and its clear date, HOA approval, line clearance
needed) that block the job from being scheduled before they're done, with a reminder before the 811 ticket expires.

### 7. Field apps that freeze, crews that won't use them

- Arborgold: "The mobile app, and field estimating part of the software was completely unusable. because of this we
  had developed a weird computer/paper filing system." ([Capterra](https://www.capterra.com/p/12741/Arborgold/reviews/?page=2))
- MobileCrew 3 (Arborgold's crew app): "Good when it works", "Constantly freezes up."
  ([App Store](https://apps.apple.com/us/app/mobilecrew-3/id1155619302))
- SingleOps: the interface "wasn't intuitive" and the mobile app was clumsy. ([ArboristSite](https://arboristsite.com/threads/what-software-should-i-use.352101/))
- Backyards and rural lots have weak signal.

This is the same complaint Flake was built around, and Flake's answer (a text link, no install, offline outbox) carries
straight over.

### 8. Storm work: surge, triage, insurers, collecting

- Firms prepare before a storm and dispatch once it's safe to run equipment. ([NALP](https://blog.landscapeprofessionals.org/tree-care-the-logistics-of-storm-cleanup-services/))
- An insurer balked at emergency charges homeowners had agreed to; desperate homeowners write checks that bounce or
  ignore later bills. ([TCI Magazine](https://tcimag.tcia.org/business-strategy/working-with-insurance-companies-on-storm-damage-claims/))
- Homeowner policies often cap tree removal at $500 to $1,000 per tree (a search summary; not traced to one source.
  Coverage guides: [United Policyholders](https://uphelp.org/claim-guidance-publications/whats-up-with-trees-shrubs-and-landscaping-insurance-coverage/),
  [Texas OPIC](https://www.opic.texas.gov/news/know-your-coverage-trees/)).
- Davey's utility segment notes revenue depends on storm work in some years. ([Davey 10-K FY2025](https://www.sec.gov/Archives/edgar/data/277638/000162828026015920/davey-20251231.htm))

**What would help:** a storm intake queue (address, photos from the caller, "is it on the house / on a wire / blocking
the driveway"), triage by danger, wire-down calls routed to the utility instead of a crew, a deposit taken at
approval, and an adjuster packet (before photos, times, the work) per job.

### 9. Price

- ArboStar from $149/mo, Arborgold $129/mo flat, SingleOps about $200 per user per month, Jobber $39 to $199/mo.
  ([Capterra](https://www.capterra.com/p/198069/ArboStar/pricing/), [Capterra](https://www.capterra.com/p/12741/Arborgold/pricing/),
  [Software Advice](https://www.softwareadvice.com/field-service/singleops-profile/))
- "Very expensive for the size of our company." ([ArboristSite](https://arboristsite.com/threads/what-software-should-i-use.352101/))

Flake's model (free software, a small fee on payments) fits here too, and tree tickets are large, so the fee cap
matters more.

### 10. Pesticide records for plant health care

States require application records from commercial applicators. Contents typically include the customer and site,
start and stop times, what was treated, the product and EPA number, rate, and the applicator. Retention runs from 2
years (Oklahoma) to 3 (Kentucky) to 7 (Washington). Restricted-use records must go to the customer within 30 days in
some states. ([Indiana OISC](https://oisc.purdue.edu/pesticide/pdf/comm_app_recordkeeping.pdf),
[Washington RCW 17.21.100](https://lawfilesext.leg.wa.gov/law/RCWPDF/RCW%20%2017%20%20TITLE/RCW%20%2017%20.%2021%20%20CHAPTER/RCW%20%2017%20.%2021%20.100.pdf),
[Kentucky](https://entomology.ca.uky.edu/files/2019_pesticide_application_record_keeping.pdf),
[Florida](https://ask.ifas.ufl.edu/publication/pi012), [USDA AMS](https://www.ams.usda.gov/node/37905))

**What would help:** the PHC visit screen writes the legal record as a side effect of the tech tapping through it, the
product list carries EPA numbers and label rates, and the record goes to the customer automatically.

### Lower on the list

- **Disposal:** dump fees, chips and logs per job, for job costing.
- **Equipment upkeep:** hours on chippers, grinders and saws; Flake's equipment log covers this.
- **Upsell:** follow-ups for stump grinding, the next pruning cycle and PHC programs (Davey's sales reps are tasked
  with building annual PHC programs per the job postings below).

## 3. Competitors (public prices, checked Nov 24, 2026; verify before quoting)

| Tool | Price seen | Notes |
| --- | --- | --- |
| ArboStar | From $149/mo yearly; GetApp lists $250/mo | Tree specific. CRM, estimates, scheduling. 4.8/5 on 47 Capterra reviews. No Google Calendar sync at one point. |
| Arborgold | $129/mo flat | Tree and landscape. Mobile estimator praised by some, called unusable by others; crew app freezes. 4.3/5 on 65. |
| SingleOps | About $200 per user per month | Tree and landscape. Tree inventory, site maps, PHC. Strong sales results reported, clumsy mobile. 4.4/5 on 108. |
| Jobber | $39 to $199/mo | General field service. Large user base; not tree specific. |
| QuoteIQ, Housecall Pro | About $30 to $60/mo | General. |
| TreeKeeper (Davey) | Tiered yearly | Tree inventory for cities and large properties. Owned by Davey Resource Group. |
| Clearion, Trimble Vegetation Manager, Esri-based tools | Enterprise | Utility line clearance work planning and audit. A different market. |

Sources: [Capterra](https://www.capterra.com/compare/176935-198069/SingleOps-vs-ArboStar), [GetApp](https://www.getapp.com/industries-software/a/singleops/compare/arbostar),
[Software Advice](https://www.softwareadvice.com/forestry/arborist-comparison/), [Davey TreeKeeper](https://www.davey.com/environmental-consulting-services/treekeeper-inventory-management-software/),
[Trimble](https://www.trimble.com/en/blog/construction/article/4-ways-trimble-vegetation-manager-help-modernize-utility-vegetation-management-programs).

**Where the gap is:** nobody leads with the marked-tree handoff, a signed briefing, or a proof packet. The tree tools
are office-first (CRM, estimates, invoices) with weak field apps. That is the same opening Flake found in snow.

## 4. Davey Tree

- **Size:** $1.95B revenue in 2025, up 5.8%. Two segments: Residential and Commercial (R/C, up 7.0%, led by Commercial
  Landscape Services) and Utility (up 5.4%). Two acquisitions in 2025. Employee-owned, headquartered in Kent, Ohio.
  ([Davey 10-K FY2025](https://www.sec.gov/Archives/edgar/data/277638/000162828026015920/davey-20251231.htm))
- **How R/C sells:** Arborist Sales Representatives give estimates, build annual PHC programs, set up and supervise
  crews on customer jobs, and help the district manager run the office. Pay ranges seen: $50k to $100k plus commission.
  ([Davey jobs](https://jobs.davey.com/job/Arborist-Sales-Representative/227869-en_US/),
  [Ladders](https://www.theladders.com/job/arborist-sales-representative-the-davey-tree-expert-company-spring-valley-ny_82535251))
- **Their own software:** Davey owns TreeKeeper (tree inventory). An older internal summary says R/C uses "computer
  field data collection." Utility uses GIS tools such as NISC MapWise. No public source names the system their R/C
  crews schedule and work from. ([Davey service lines](https://welcome.davey.com/english-assets/Pre-Day%201/Service%20Line%20Summaries.pdf),
  [Davey jobs](https://jobs.davey.com/job/Geospatial-Analyst/231020-en_US/))
- **What this means:** Davey is an enterprise buyer: security review, single sign-on, links to their payroll and
  accounting, many district offices. Flake already has a start on some of this (`docs/SSO_SETUP.md`,
  `docs/SECURITY_QUESTIONNAIRE.md`, branches). A whole-company deal is a long sale; a pilot in one district office on
  one pain is realistic. The same product sells to the thousands of small tree companies Flake-style.
