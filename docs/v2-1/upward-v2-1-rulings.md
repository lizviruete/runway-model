# Upward V2.1 — Rulings

Answers to the conflicts surfaced by the pre-build repo audit (2026-08-19). **These override the build prompt and the design package wherever they disagree.** Read this file alongside every item.

Lettered to match the audit.

---

## a · Test infrastructure — use the pure layer, do not add jsdom/RTL

**Ruling: option 2.** Push each item's decidable logic into pure `lib/` modules and assert there. Do **not** add jsdom or React Testing Library in V2.1.

**Context the audit did not have:** a DOM/RTL component-test harness is **already a logged V3 carry-forward item**, and the `data-testid`s seeded in PR #4 exist for exactly that future work. Adding it now would pull a V3 item into an already-large release.

Consequences, accepted deliberately:

- Item 1's "chart legend order" assertion becomes an assertion on the **engine output the legend maps over**, not on rendered DOM. Correct — that is where the ordering guarantee actually lives.
- Item 7's copy states are asserted on the pure function that produces the summary string, not on the rendered bar.
- Item 10 gets **no automated test.** It is a presentation-only change; assert the cash-zero *value* and the chart marker are unchanged and leave the color to manual QA.

The rendered layer is covered by manual QA per item, which is already in the runbook. This sets the pattern for all ten items.

---

## b · Chart default view and URL persistence — rename only

The design package asserted a status quo that is not true. Correct:

- **Rename the labels.** In scope per item 6: *Balances · total* and *Balances · by account*. Two segments, not three.
- **Do not flip the default.** It stays on the total / net-liquid view. That was a deliberate past decision with a comment explaining it, and changing the first thing a user sees is a real product change neither document asked for.
- **Do not add URL persistence.** Leave the mode in React state. Logged as a small carry-forward.

Revisit the default after the columns are live and can be looked at.

---

## c · The chip follows the tap-position palette

The sharpest catch in the audit. `TYPE_COLORS` is keyed by **account type** and drives both the chart band and the account card's number chip. Item 6's palette is keyed by **tap position**. Left alone, the chip would stop matching its band and break the card ↔ chart coupling.

**Ruling: the number chip follows the tap-position palette,** so chip color and band color stay identical.

Reasoning: the chip *displays the tap-order number*. Coloring it by tap position is more coherent than coloring it by type, and the coupling is load-bearing — it is how a user connects a card to a band. The do-not-change list protects number-chip **geometry** (size, shape, radius), not its fill; the fill change is sanctioned by item 6's palette work.

Keeping the chart type-keyed is not an option: two accounts of the same type would collide, which is the whole reason the palette moved to tap position.

**On tokens:** it is fine that the ten `--chart-*` values are the first real tokens in the codebase. The meaningful claim — *no new spacing, radius, or type values* — still holds. `TYPE_COLORS` may be retired or narrowed as part of item 6.

---

## d · Definition of done, amended

**"All previously existing tests must pass"** is replaced by:

> All previously existing tests pass, **or are deliberately rewritten with the change recorded in the PR description.**

Items 2 and 8 necessarily rewrite the sample-scenario suite (the seven-account assertions, the cascade-order test naming Brokerage and Roth IRA, the housing-change and one-asset-sale assertions). That is expected work, not breakage — but every rewritten test must be called out in its PR, not silently changed.

**`lib/presets.ts` is in scope for item 2** and the build prompt was wrong to omit it. All five presets read `levers.housing` and `levers.targetMonthlySpend` directly and must move onto the expense primitive. Note the binary search in `surviveToYearEnd` is the solver the roadmap expects to generalize into V3's goal-seek mode — **it must keep working**, and it deserves an explicit test after the migration.

---

## e · Rate of return — one `expectedReturn` field, migrated from the existing yield

The audit is right that item 3 is half-shipped: the HYSA yield is already user-editable via `ongoingCost.kind === "interest_earned"`; only the default is hardcoded.

**Ruling: add a single `expectedReturn` field to eligible asset types, and migrate the existing HYSA yield into it.** Reserve `ongoingCost` for actual costs — that is, liabilities.

Do **not** promote the other types to `interest_earned`. `ongoingCost` is semantically a *cost*; overloading it to also mean *return* conflates the two things item 3 explicitly requires stay distinct. One field, one meaning.

**Defaults**, as named constants in one place:

| Type | Default |
| --- | --- |
| High-yield savings | **4.0%** — keep the repo's existing `0.04` |
| Brokerage / investment | 6.0% |
| Roth retirement | 6.0% |
| Pre-tax retirement | 6.0% |
| Other | 0% |

The mockup's 4.2% is illustrative of the *pattern*, not normative. Do not churn a live value for a 0.2% cosmetic difference.

---

## f · Keep the repo's field names — the spec block was a sketch

**Ruling: the audit's reading is correct.** The `{ label · amount · cadence · starts · ends? }` block in the build prompt is a **shape sketch, not a naming mandate**. Keep `FlowEvent`'s existing names — `kind`, `startDate`, `endDate`. Renaming them is gratuitous and would break the `?s=` payload for income as well as expenses.

**On the shared type:** add `stepChange`, `isEstimate`, and `seeded` as **optional** fields on the shared `FlowEvent`, and **gate the UI** so the step-change and estimate controls render only in the expense context. Do not fork the type — forking duplicates a working shared modal for no gain.

Income step-change falls out of this almost free. **Do not enable it in V2.1** — it is untested and out of scope — but log it as a V3 candidate, since "my salary changes in March" is a real need.

---

## g · Migration covers all five entry points

**Ruling: correct, and this is the highest-consequence part of the release.**

The migration must be a **single function applied at every hydration boundary**, not just `decodeScenario`. All five:

1. `?s=` via `decodeScenario` in `lib/share.ts`
2. `runway:saved` (array) in `lib/storage.ts`
3. `runway:last`
4. `runway:baseline`
5. `runway:savedBaseline`

Add a version field to `Scenario`; missing or unknown means v1. **Write one test per entry point.** If any of the five bypasses migration, a user with saved state gets silently wrong numbers — which is the worst failure this product can have.

---

## h · Footer — merge into the existing one, hide under `?chrome=min`

> **Partly superseded by ruling (r):** the feedback link is dropped. The footer's *placement* rulings below still stand and now govern the privacy line alone. ~~Destination URL: pending from Liz.~~ There is no URL to supply.

- **Merge, do not stack.** One footer. The existing "Sample data is fictional. Not financial advice." disclaimer and the privacy line live together in the current footer element. Take the spec's left alignment and 40px spacing.
- **Yes, it hides under `?chrome=min`** with the rest of `data-chrome`. That mode is the embedded view used by the gated portfolio page, and the line belongs to the full app.

---

## i · Exclusion behavior — the audit's reading is correct

Confirmed:

- The **card stays put** in its grid position. It does not move to the end.
- The **legend keeps its tap-order position.**
- The **ledger sorts excluded lines to the bottom.**

This matches the mockup and the "an excluded account loses its number" idea. The §4 phrase "at the end of the tap order" was loose drafting; ignore it.

---

## j · VS. BASELINE stays red — and that is the principle, not a compromise

The audit answered the open flag: `HeroMetrics.tsx` passes `tone="bad"` when `deltaMonths < 0`, using the same `text-red-600` as the cash-zero figure.

**Ruling: leave it. Do not neutralize it.**

The two reds are not the same kind of red:

- **Cash-zero red** marks a permanent condition — your money runs out. It is always true, always visible, and unavoidable. Coloring it alarms someone about a fact they cannot change by looking at it.
- **Vs-baseline red** marks a **state change** — the change you just made cost you two months. It is the direct consequence of an action taken seconds ago, and it is actionable.

Item 7's own rule is *emphasis reserved for state changes*. By that rule, vs-baseline red is the **correct** use of color and cash-zero red was the incorrect one. The stat row ending up with one bi-color card is the right outcome.

---

## k · Corrections to the build prompt

- The suite is **17 files, 130 tests**, not ~121.
- Design-package paths are `docs/v2-1/dev-package.html`, `docs/v2-1/upward-v2-1-dev-package.md`, and `docs/v2-1/mockups/*.png`. Ignore the original zip paths.

---

## l · Name prefill dropped — the fallback plus the placeholder covers it

Raised during item 1's build. The build prompt instructed *"Prefill the name field from the selected type on account creation… Fallback and prefill are complementary; do both."*

**Ruling: do not prefill.** `newAccount()` keeps `name: ""` for every type, including `other` (which previously seeded `"New account"`). The build prompt's line is struck.

Reasoning: prefill is what *creates* a stale-name problem. A name prefilled as "Savings" survives a type change to Brokerage, and nothing distinguishes it from a name the user typed — so it cannot safely be refreshed either. Resolving that would mean storing which names are ours, which is new state for no gain.

The fallback plus the card's placeholder covers the same ground with none of it:

- adding an account leaves the field empty, with a placeholder showing the resolved display name;
- changing the type updates the placeholder, the legend and the ledger together;
- a name the user typed is never overwritten, because there is nothing to overwrite it with.

Smaller diff, no new state, and the `other` type stops being a special case. A test in `lib/scenario.test.ts` locks the empty name so it is not "helpfully" re-added.

This does **not** change the fallback itself, which is the item's actual fix, or the placeholder change on the card — both ship.

---

## m · Mutation-check new coverage before reporting a stage green

With no rendered-layer tests (ruling (a)), "the suite is green" proves less than usual — it is easy to write a test *around* a defect rather than *for* it. Before reporting a stage done, break the thing the new tests describe and confirm they fail, then restore.

Report which mutations were tried and what caught them. This is standing for every item, and it matters most for items 5 and 7, whose decidable logic is easy to assert loosely.

---

## n · A derived fact resolves once, in the engine

When two surfaces need the same derived number, the engine computes it and both read it. They must not each derive their own.

The case that named this: monthly **net** (in − out). The chart tooltip (item 6) and the ledger NET column (item 7) both need it, so it lands on `MonthLedger.totals.net` in item 2 — before either consumer exists. The same reasoning already applies to `accountDisplayName` (item 1), and should be the default for the excluded-account and estimate facts too: a component that re-derives is a component that can disagree.

---

## o · A version from the future is rejected, not guessed at

The build prompt said to treat missing/unknown as v1. "Unknown" meant **no version field**, which is v1. A version from the future is a different case.

**Ruling:** missing or `1` → migrate; `2` → pass through; `> 2` or unparseable → **reject**.

Attempting a v1 migration on a v3 payload is strictly worse than declining it: a later deploy will know how to read it, this one should not guess. Rejection degrades to "nothing stored", which every hydration boundary already handles.

---

## p · Take the transaction-order change; keep one clean loop

Collapsing housing, living spend and added expenses into one loop moves the asset **carrying cost** from between housing and the added expenses to after the whole list.

**Ruling: take the reorder.** No financial value changes — runway, cash-zero and every monthly ledger total are identical. Only `transactions[]` display order moves, only in the Transactions view and its CSV, and only for a scenario with an asset sale that carries a monthly cost.

Splitting the loop to preserve byte-identical ordering would reintroduce exactly the two-class distinction §1 exists to remove, which is a bad trade for a cosmetic property. **Note the CSV ordering change in the PR.**

Worth knowing: item 8 drops the asset-sale lever from the example, so the demo path never hits this.

---

## q · Seeded rows get no special-case rule

Seeded rows must behave exactly as user rows do. Before writing a rule, check what user rows actually do.

**The finding:** user labels **are** editable after creation — `FlowModal` renders a Label field and is reopened with the existing event when a row is clicked. So seeded labels are editable too.

**Consequence:** the Transactions view suppresses the category suffix when the label is **redundant** — either the category's own name or a seeded line's default label. Rename housing to "Mortgage" and "Housing · Mortgage" correctly returns, which is what a renamed user row gets.

The rule is about the label being redundant, **not** about the row being seeded. A rule keyed on `seeded` is the two-class distinction sneaking back in through a different door.

---

## r · The feedback link is dropped; the privacy line is kept

Item 9 as written pairs a quiet feedback link with a privacy line. **Ruling: ship the privacy line alone.** No link, no external form, no new-tab behaviour, and no destination URL to source.

Chris asked for *"a section in the app for feedback and support"*. That is the V3 instrument, designed alongside the analytics that give it something to act on — not a placeholder link pointing at a Google Form. Shipping the stopgap would answer the request in form while missing it in substance, and it would have to be removed again to build the real thing.

**The privacy line stays, and stands on its own.** §7 justified it as the antidote to the suspicion a feedback link invites, but that gets the causation backwards: the *product* raises "where does this go?" the moment it asks for account balances. The link was only what prompted saying it out loud. Removing the link does not remove the question.

So item 9 becomes **"Footer privacy line"**: one line, §7's placement and geometry, merged into the existing footer per ruling (h), hidden under `?chrome=min`.

This also closes the open question at the end of this file — there is no feedback URL to supply.

---

## s · Copy that ships is built as a string in the pure layer, never assembled in JSX

Interleaving text and `{expressions}` across JSX lines silently drops interior spaces. Nothing below the browser can see it: the source reads correctly, the compiler is satisfied, and the suite stays green. It shipped as `this $5,000isn't part of your runway` in item 5 and was caught only by driving the app.

**Ruling: any string a user reads is produced by a pure function and asserted there.** The component renders the result; it does not assemble it.

This is the rule, not a habit. It already applies to §4's two exclusion strings, item 3's `returnFaceClause` and `penaltyStatusLine`, item 2's `expenseMeta` and `expensesHeadline`, and item 1's `accountDisplayName`.

**It matters most in item 6**, whose tooltip assembles per-series rows, an event line and several edge-state captions — the densest copy surface in the release, and the one where a dropped space would be least visible in review.

A useful shape for these tests: assert the exact string, and separately assert `not.toMatch(/\s{2}/)` across a range of inputs. The second catches the inverse mistake.

---

## t · Tests must not depend on POSITION

Array index, column order, field order, spread, or enumeration — **any of these silently rebinds when the shape changes**, and the test keeps passing while asserting something different.

Four instances this release, one hazard:

| Where | Mechanism | What it hid |
| --- | --- | --- |
| `applyTypeDefaults` spreading over `Account` | spread kept a field it should have reset | a **stale** field (`expectedReturn` surviving a type change) |
| `chartWindow` fixture spreading over `Levers` | spread accepted a key the type no longer had | a **removed** field (`targetMonthlySpend`, a silent no-op) |
| `acct()` builder enumerating `Account` fields | enumeration ignored a key it did not list | a **new** field (`excluded` never reaching the engine) |
| The CSV invariant indexing **positionally** | `f[f.length - 1]` rebound from `closing` to `net` | a **new column**, swept into the category sum |

**The CSV case is the sharpest.** The other three broke or under-tested — a failure you eventually see. That one **continued to pass while quietly asserting a different invariant**: `opening + sum(categories) = closing` became `opening + sum(categories, including closing) = net`, still green, still named the same thing, no longer true of anything.

TypeScript catches none of them: excess-property checks do not fire through a spread, `Partial<Account>` accepts a key whether or not the body reads it, and an array index is just a number.

**Ruling: look things up by NAME.**

1. **Test builders spread their overrides last** — `const { priority, ...overrides } = o; return { ...defaults, ...overrides }` — so a field added to the type propagates for free.
2. **Production code that spreads a typed object keeps its type-derived fields in ONE object** (`typeDerived()`), and a test enumerates that object's keys, because the compiler cannot.
3. **Tabular assertions resolve columns through the header**, never by index or offset — `header.indexOf("closing")`, not `f.length - 1`. The same applies to any ordered output a test slices into: transactions, ledger rows, legend entries, tooltip rows.

None of this is optional going into items 8–10, all of which touch types and outputs the fixtures read.

---

## u · Alternating-lightness palettes guarantee separation only for CONSECUTIVE positions

§5's chart palette alternates dark and light by tap position, so that adjacent bands differ in luminance as well as hue. Validated on **adjacent pairs** it passes comfortably — worst ΔE 31.8 under deuteranopia.

**That validation is only true while adjacency means "consecutive tap positions".** Two shipped features break that:

- **Exclusion (item 5)** — exclude tap 3 and taps 2 and 4 become adjacent bands.
- **Manual draws (V2)** — a dated tap can empty account 5 while 3 and 4 still hold money.

Run `--pairs all` instead of adjacent and §5's palette fails: taps 2 and 4 (`#7dd3fc` sky, `#f0abfc` fuchsia) are **ΔE 1.4** for a deuteranope — the same colour.

**Ruling: validate `--pairs all`, never adjacent, whenever the series set can be filtered, reordered, or drained out of order.** Adjacent-pair validation is only sound for a stack whose members can never be removed from the middle.

### What was attempted, and the honest result

Re-deriving the four light values with the darks fixed reaches worst all-pairs CVD **ΔE 4.8** — still under the ≥8 target. Given a free hand over all eight, the ceiling is CVD 11.9 and **normal-vision ΔE 12.3, under the hard floor of 15**.

| Series | worst all-pairs CVD | worst all-pairs normal |
| --- | --- | --- |
| 4 | 28.9 | 29.5 ✓ |
| 5 | 14.3 | 18.7 ✓ |
| 6 | 13.5 | 13.8 ✗ |
| 8 | 11.9 | 12.3 ✗ |

**Eight categorical series cannot pairwise separate. All-pairs separation tops out at five.** This is a property of the colour space, not of §5's choices, so churning the palette to get closer buys nothing.

### For V3 — do not re-run this search, and do not treat repetition as a defect

**Eight series already sit past the wall.** The table above is the break-even, measured: five is the last count at which every pair separates.

V3 adds three account types — company stock / RSUs, HSA, CD / treasury — so scenarios with **nine or more accounts stop being rare**. §5's fallback (the rotation repeats from tap 1 with a 12% lightness shift beyond eight) is therefore **not a compromise made for convenience. It is the only available answer.**

It is acceptable precisely **because colour was never the identifier.** Once the tap number, the surface gap and the named legend and tooltip rows carry identity, a repeated hue costs scanning speed and nothing else. A future version that reads the repetition as a defect and goes looking for a ninth distinguishable hue will not find one — the search above already failed to find an eighth.

If nine-plus accounts become the common case rather than the tail, the answer is a different *encoding* — small multiples, a folded "Other" band, or composite marks — never more hues.

**Therefore the palette is kept exactly as §5 specifies**, and robustness comes from making colour *secondary*:

- the **tap number in the legend entry**, so position and number are the primary channel — a collision degrades to "harder to scan", not "cannot tell which band is which";
- the **2px surface gap** between stacked segments, which separates neighbours regardless of hue;
- §5's **1px stroke** on light fills, which stops a thin band vanishing against white (a different problem from the gap — keep both);
- the legend and tooltip **naming every series**, which §5 already requires.

### The part worth carrying forward

**This was only reachable because item 5 shipped.** The design package validated its palette against the product as designed; a later item in the same release invalidated that validation by letting a series be removed from the middle of the stack.

A design package's validation is a snapshot of the product it was drawn against. **Re-run it rather than trusting it** — especially the computable checks, which are cheap to re-run and impossible to eyeball.

---

## v · `formatRunway` stays as-is; all-excluded reads "0.0 weeks"

§4 says the all-excluded state reads "runway reads 0.0 months". It renders **"0.0 weeks"**, because `formatRunway` switches to weeks below one month — the formatter's own rule, applied consistently to every sub-month runway.

**Ruling: no change.** §4 wrote "months" as an illustrative string, not as a considered decision about the sub-month branch, and both phrasings say the same thing. Special-casing zero creates an exception every future reader has to discover.

Logged for later: if zero deserves distinct copy — "None", or the figure suppressed entirely — that is a **copy decision about the zero state**, not a formatter exception, and should be taken as one.

---

## w · Mutation testing proves your tests test your code. It does not prove your code is REACHABLE.

The sharpest thing this release has taught.

Item 6's tooltip was **100% covered and 0% visible**. `lib/chartTooltip.ts` had 22 passing tests over a model that **no component imported** — the chart had no hover layer at all. The mutation table was *structurally blind* to it: mutating the model still fails the model's own tests, so every row passed while the feature did not exist on screen.

A mutation table answers "do my tests notice when this code changes". It cannot answer "is this code on the page".

Both of item 6's defects passed **tsc, eslint, 388 green tests, AND a clean production build**:

1. The tooltip, built and tested and never rendered.
2. Every column rendering **black** — SVG presentation attributes do not parse `var()`, and Tailwind v4 had stripped the ten custom properties from `globals.css` anyway, because no CSS rule referenced them.

That makes **five rendered-layer defects** this release — the type-label lowercase, the untypeable minus, the JSX space, and these two. **These two were the most severe**, and they are the only ones where every automated gate was green.

**Ruling: live verification in Chrome is not a formality and not a nice-to-have. It is the ONLY check that proves reachability.** Standing for every remaining item.

Practically, that means before reporting an item done: open it, drive the thing the item added, and read the actual rendered values — not a screenshot alone, which shows presence but not correctness. Ruling (a) confines testing to the pure layer; this is the compensating control, and it is load-bearing.

### A second instance — item 10, and it is the same failure with the check inverted

Item 10 reported *"zero red elements anywhere in the ledger, measured across every rendered leaf node."* The measurement was real and the claim was false: it ran against the **collapsed** table. `LedgerView.tsx:252` (`bg-red-50`) renders outflow category pills as `bg-red-50` / `text-red-700` inside the **expanded per-account block**, which the sweep never opened.

For the primary user — someone in an income gap — **outflow pills are nearly all the pills there are**. So the wall of red did not go. It moved down one level, into the surface that exists to be "the auditable trail behind every number".

The tooltip instance was *unreachable code that looked covered*. This is its mirror: **reachable code that the verification never reached**. Both produce a confident green from a check that never touched the thing it claimed to check.

**So the live pass needs the same question the mutation table needs:** not "did I verify it" but "what can this verification structurally not see?" A DOM sweep sees only what is currently mounted. Anything behind a disclosure — an expanded row, a tab, a hover, a modal, an empty state — is invisible to it and will report clean. **Enumerate the disclosure states and open each one**, or say plainly which ones went unchecked.

---

## x · Sanctioned deviations from §5's geometry

Two, both taken deliberately, both recorded so a later reader does not "restore" them.

### The 2px surface gap between stacked segments

§5 says segments **butt** with no gap, and that light fills carry a 1px stroke of their dark partner. The dataviz method says the opposite on the first point: a 2px surface gap separates touching marks, and *"neighbors one step apart read distinct because of the gap, not a stroke drawn around them."*

**Ruling: take the gap, and keep §5's strokes.** They solve different problems. The gap separates any two touching bands **regardless of hue**, which is what the palette cannot do once exclusion puts non-consecutive series side by side (ruling u). The stroke stops a thin light fill vanishing against white, which the gap does not address. The method's "never a border" rule is written for a border used *instead of* a gap, which is not what §5's strokes are doing.

### The pinned tooltip

§5 specifies a tooltip that follows the cursor at a 12px offset and flips side 260px from the right edge. It is pinned to whichever side is away from the hovered band instead.

**Ruling: keep the pinned tooltip.** §5's actual requirement is *"it never covers the hovered column"*, and pinning satisfies that **more robustly** than offset-plus-flip, which has an edge case at every boundary the flip has to detect. It is also calmer — and calm is the product principle, not a preference.

---

## y · A turnaround is a change in your RECURRING position, not a one-off top-up

On the example scenario, item 7's summary bar read **"turns positive Sep 2026"**. September nets +$7,769 — entirely because of an $8,000 one-off asset sale. Its recurring position is **−$231**, and October returns to −$3,931 and never recovers.

**Ruling: a month qualifies as the turnaround only if its net would still oppose the regime with one-time inflows excluded.** The engine records `MonthLedger.totals.oneTimeInflow` (one-off income events and asset-sale proceeds), so `net − oneTimeInflow` is the recurring position and the turnaround reads from that. Per ruling (n) it is recorded once, in the engine, rather than re-derived.

**Why not persistence-to-end-of-window.** That rule fails the case where income genuinely resumes in March and one bad month lands in June — it would report "no month turns positive" and understate real good news. Option (b) has no equivalent failure, because **a one-off extends your RUNWAY**, which the runway figure and the cash-zero date already report. The turnaround clause reports when your **monthly position** flips. Conflating them tells someone their situation improved when only their balance did.

And "turns positive Sep 2026" for a one-month blip is **false hope handed to someone in financial distress** — the worst direction to be wrong in, which rules out simply accepting it.

### The asymmetry is deliberate

**The rate still includes the spike**, shown as a range. The range is already honest about variation, and a range makes no claim about the future. **The turnaround is a date claim** and has to mean something durable. Different obligations, different treatment.

### The pattern — a design package's worked example is not a test case

This is the **second time §6's own example contradicted its own copy states**:

1. **Gross vs net burn rate** — the summary reads "Burning about $7,900/mo" beside a row reading `IN $3,913 · OUT −$7,900 · NET −$3,987`, pairing a gross rate with a net turnaround in one sentence.
2. **This** — the six states were written assuming a single sign change, and the package's own example scenario violates that assumption with a one-off inflow.

**Treat a design package's worked example as illustrative, not normative.** The copy states are the specification; the example is a sketch drawn to show them off, and it can quietly encode assumptions the states do not hold to. Where they disagree, work out which is true rather than implementing the example.

---

## z · Stop colouring by SIGN in the ledger — item 10 widened

**Item 10 as written was too narrow.** The design package appendix flagged only the OUT column. QA of item 7's never-positive state found it is worse than that: `LedgerView`'s `Amount` component colours by **sign** (`value < 0 → text-red-600`), so once a scenario depletes, OPENING and CLOSING go red on every row too.

In the never-positive state the ledger reads:

| OPENING | IN | OUT | NET | CLOSING |
| --- | --- | --- | --- | --- |
| red | — | red | neutral | red |

**Item 7's one calm column sits between three loud ones, which is why its restraint is invisible on the page.** Shipping NET neutral and stopping there did not deliver the change it was written to deliver.

### The rule

**The sign is already in the number and the direction is already in the column header. Colour adds only alarm.**

That is the same argument that made NET neutral, applied **consistently instead of to one column**. A rule applied to one instance of the thing it describes is not a rule; it is a special case, and the surrounding inconsistency swallows it.

### Scope

`Amount` is used in **five** places, all of which stop colouring by sign:

1. the OPENING cell
2. the CLOSING cell
3. the per-account `open` figure inside an expanded month
4. the per-account `close` figure inside an expanded month
5. the Transactions view's amount column

Still in scope for item 10 as previously agreed: **the cash-zero date figure goes near-black** (`#111827`), and **the chart's dashed cash-zero marker stays red**.

### What keeps its colour, and why

The IN column stays green, and the category pills inside an expanded month keep their green/red treatment. Those encode a **category** — money in, money out — not the sign of a running balance. The distinction is the whole rule: colour may carry a *kind*, which the number cannot; it may not restate a *sign*, which the number already carries.

---

## aa · The ledger is not capped or truncated in the never-positive state

Capping the ledger, or collapsing it behind an expand click once a scenario depletes, was proposed during item 7 QA and **rejected**.

**The ledger claims to be "the auditable trail behind every number".** Putting the trail behind an expand click undermines the one thing it is for. Auditability that requires a click to reach is not auditability; it is a footnote.

Three reasons the perceived problem is not the row count:

1. **People jump to a month to check it** — they do not read all 24 rows top to bottom. The cost of length is not paid the way it looks like it is paid.
2. **The chart already carries the shape.** Whoever wants the trend has it; whoever opens the ledger wants a specific month.
3. **The perceived heaviness is colour, not row count** — which is ruling (z), and is the change that actually addresses it.

Fix the cause. Do not truncate the evidence.

---

## bb · Two summary-line copy candidates, deferred until after item 10

The never-positive summary currently reads:

> Burning about $7,980/mo · no month turns positive in this view

It lands as a **verdict**. Two candidates were considered and **both are deferred deliberately** — that line is currently being judged *above three red columns*. Re-judge it once the ledger is neutral (ruling z), so we **move one variable rather than two**.

### (a) WITHDRAWN — "steady through Aug 2027"

Aug 2027 is only the end of the 24-month window. The phrasing implies **something changes at a date where nothing does**.

Same error class as ruling (y): **a date attached to a claim the date does not support.** Withdrawn, not deferred — it is wrong, not merely unready.

### (b) CANDIDATE — keep the existing copy, add a pointer to the levers

Phrase it as **mechanism, never outcome**:

- ✅ "every number here responds to the levers on the left"
- ❌ "test scenarios for a more favorable outcome"

The second **promises a better outcome is available**, which for someone with no income may simply be false, and reads as *"have you tried having more money"* — reproducing the tone problem one line down from where item 7 fixed it.

A pointer is defensible because **it names something real**: the levers exist, and the summary bar is `aria-live`, so changing one announces the new number immediately. **It promises a mechanism, not a result.**

---

## cc · A fixture must use values the real world actually produces, not tidy ones

**Tidy values sit on boundaries, and a suite built from them tests the boundary rather than the behaviour.**

Both defects found in item 8 share this root:

1. **$8,000 severance against $8,000 of spend** — a coincidence no real scenario produces — netted the opening month *fractionally positive*. Item 7's summary bar takes its regime from the first month, so the demo's headline read **"Adding about $109/mo · turns negative Oct 2026"**: the opposite of the crunch the example exists to show.
2. **Anchors were all first-of-month**, which the real clock produces on **1 day in 30**. At `2026-08-20` the partial opening month moves the runway by two thirds of a month — drift the old test structurally could not see.

### This is a THIRD way a green suite hides a real defect

Distinct from (m) and (w), and not reachable by either:

| Ruling | What is wrong | What finds it |
| --- | --- | --- |
| (m) | The tests do not test the code | Mutation testing |
| (w) | The code is not reachable | Driving the live app |
| **(cc)** | **The code is reachable AND correct AND covered — the FIXTURE is unrepresentative** | **Asking whether the inputs are plausible** |

In item 8 the code was reachable, correct, and covered. Eleven mutations were all caught. Neither mutation testing nor live verification finds this class — **only asking whether the inputs are plausible.**

### Scope

**Applies to seed data as much as to test fixtures.** The example scenario is a fixture the user reads, and an implausible one misleads more directly than a test fixture ever can — see [[z]] for what item 8's seed had to change and why.

Round numbers in shipped seed data are a deliberate exception with its own justification (nobody should mistake the demo for a real person's finances), which is exactly why the *relationships between them* need checking against reality even when the values themselves are round: $7,000 of severance against $8,000 of spend is round AND unambiguous, where $8,000 against $8,000 was round and sat on the boundary.

---

## dd · "Does colour carry meaning alone?" and "does raising it cost scanning?" are two questions

Item 9's contrast fix surfaced 50 uses of `text-zinc-400` at **2.56:1**, and the audit of them applied ONE test to answer TWO questions. That produced a wrong claim in each direction.

| Question | Domain | Answer, for the de-emphasis cases |
| --- | --- | --- |
| Does colour carry the meaning **alone**? | accessibility | **Nowhere.** Not one case. |
| Does raising it cost **scanning**? | design | **Yes**, in the chart tooltip. |

### What is actually true about the de-emphasis cases

**"Raising these would break the signal" was true of NONE of them.** Every one pairs `text-zinc-400` with a second channel that carries the meaning by itself:

| Site | The second channel |
| --- | --- |
| `RunwayChart.tsx:369` (`truncate text-zinc-400 line-through`) | `line-through` |
| `RunwayChart.tsx:453` (`>excluded</span>`) | the literal word "excluded" |
| `LedgerView.tsx:234` (`line-through`) | `line-through` |
| `LedgerView.tsx:238` (`excludedLedgerLine`) | `excludedLedgerLine()` states the held balance in words |
| `LedgerView.tsx:50` (`value === 0`) | the number already reads `$0` |
| `RunwayChart.tsx:379` (`row.zero ?`) | **the number already reads `$0`** — `tooltipModel` sets `value: formatCurrency(...)`, and the comment above it says the `$0` is shown deliberately rather than dropped |

`RunwayChart.tsx:379` (`row.zero ?`) was initially called the one colour-alone case. It is not. There is no colour-alone case in the category.

### Why the tooltip rows stay grey anyway

**Greying `$0` rows costs scannability, not information.** In a panel whose contract is that the rows sum to net liquid ([[x]]), empty rows rendered as loud as funded ones is noise — the reader is scanning for which accounts still hold something.

So the decision stands, but **it is a scanning decision, not a second-channel one**, and it has to be recorded as such. Filed under "colour carries the meaning" it reads as an accessibility constraint, and the next person to touch it — item 11 — will apply the accessibility test, find it passes, and raise it.

### The general form

When a de-emphasis treatment comes up for review, answer both questions and say which one you are answering. The accessibility question governs whether raising it is **permitted**; the design question governs whether raising it is **wanted**. A "leave it" that does not say which question produced it will be re-derived wrongly.

---

## ee · A kind-encoding must colour EVERY kind in the set, or none

Ruling (z) drew the line as **sign-colouring goes, kind-colouring stays**, and used it to keep the IN column green. That was wrong, and the phrasing is what hid it.

**Colour encoding a KIND needs at least two kinds coloured to be doing that job.** One kind coloured and the rest neutral is not an encoding — there is nothing to tell apart.

### What actually happened

Once OUT went neutral, green on IN **stopped distinguishing in from out** and merely repeated the column header, which already says IN. Worse, it became the only colour left in the table, so it took the entire remaining attention budget — and pointed it at the least decision-relevant column. In a depleted month of the example, IN reads **$6** of interest against OUT's **−$6,500**, and the $6 was the loud one.

The argument was already in the codebase. `lib/cashFlowSummary.ts`, written for item 7:

> green-for-positive fails it inverted, because rewarding positive with colour punishes negative by its absence

That justified NET having no colour. It applies to IN unchanged. "IN stays green" was never a considered exception to item 7's principle — it was a column the principle had not been applied to.

### The conflation to avoid repeating

Ruling (z) established that **colouring IN is not the same error as colouring a running balance**. It never established that **colouring IN is right**. Those are different claims, and "kind not sign" collapsed them into one.

### Applying the sharpened rule

| Surface | Kinds in the set | Coloured | Verdict |
| --- | --- | --- | --- |
| IN column | 2 (in, out) | 1, after OUT was demoted | **strip** — [[z]] |
| Category pills in an expanded month | 2 (inflow, outflow) | both | **the encoding is real** |

The same rule that strips IN is the rule that keeps the pills. That is the test working, not an exception to it.

**The pills were also reviewed live and kept** — see [[ff]]. The rule keeps them and the live look agreed; the calm principle still argues against them, which is why that is a hold rather than a closure.

### A note handed to item 11, not formalized here

With IN on slate-700, the ledger's two grey ramps now split **exactly on flows versus balances**: IN / OUT / NET are slate-700 `#314158`, OPENING / CLOSING are zinc-700 `#3f3f46`.

**That is accidental, not designed** — item 7 shipped NET as slate, the appendix specified slate for OUT, and OPENING/CLOSING are legacy zinc. It happens to look like a rule. Item 11 either unifies the ramp deliberately or makes it a real rule; it must not be treated as intentional in the meantime just because it currently lines up.

---

## ff · The expanded-ledger category pills were reviewed and KEPT — for now

Item 10 stripped colour from every ledger column. The **category pills inside an expanded month** (`LedgerView.tsx:246` / `:252` (`bg-emerald-50` / `bg-red-50`)) keep their green/red, and this records that as a decision rather than leaving it as the absence of one.

### Two independent reasons, and they agreed

1. **The kind rule keeps them.** Per [[ee]], a kind-encoding must colour every kind in the set or none. The pills colour **both** inflow and outflow, so unlike the IN column they are genuinely distinguishing two things rather than repeating a label. The same test that stripped IN keeps these.
2. **Liz looked at the expanded ledger live and they read as ordinary bookkeeping, not alarm.** `bg-red-50` is pale enough that the outflow pills read as ledger convention rather than warning — which is exactly the register the calm principle wants.

That second reason is the load-bearing one. Reason 1 says the encoding is *doing a job*; it does not say the job is worth the alarm. Only the live look answers that, and it was made on the real expanded view, not on the collapsed table that produced [[w]]'s second failure.

### The "for now" is part of the ruling

**The calm principle still argues against them.** For the primary user — someone in an income gap — outflow pills are nearly all the pills there are, so the expanded view is where a wall of red would reappear if the pale tint ever stopped being pale. Measured on the example's depleted May 2027: **3 outflow pills to 2 inflow**, and one of those two is a "Transfer in" mirroring a "Transfer out".

So this is a **deliberate hold, not a closed question.** It goes on the item 11 / 12 pile as a **watch item**: if the pill tints are ever darkened, if the ratio worsens, or if the expanded view becomes a primary surface rather than an audit one, it comes back up. Re-open it on evidence, not on taste — and re-open it by looking at the expanded view, which is the only place the question is visible at all.

---

## Also confirmed

- **The build prompt's order wins** over the design package README's BUILD ORDER block, which uses its own numbering. Read the README's order as already-translated.
- **The design package's "Do not change" list is partly superseded** — by item 10 (sign-colouring throughout the ledger per ruling (z), and the cash-zero figure), item 5 (Exclude button on the card face), and item 1 (the name field's placeholder). Each is sanctioned by its own section. Where an item's section and the do-not-change list disagree, **the item wins.**
- On names: `applyTypeDefaults()` does **not** touch the name on a type change. Never overwrite a name the user typed. Superseded in part by ruling (l) — there is no prefill to re-apply, so an unnamed account simply keeps falling back to whatever the new type is called.

---

## Closed — nothing open

~~**The feedback destination URL (item 9 only).**~~ **Closed by ruling (r):** the feedback link is dropped, so there is no URL to supply. Item 9 ships the privacy line alone.
