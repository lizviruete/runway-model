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

## t · Test builders spread overrides; they never enumerate fields

Three variants of one hazard have now shipped past the compiler in this release. **Opposite mechanisms, identical symptom: a test that silently stops testing what it claims.**

| Where | Mechanism | What it hid |
| --- | --- | --- |
| `applyTypeDefaults` spreading over `Account` | spread kept a field it should have reset | a **stale** field (`expectedReturn` surviving a type change) |
| `chartWindow` fixture spreading over `Levers` | spread accepted a key the type no longer had | a **removed** field (`targetMonthlySpend`, a silent no-op) |
| `acct()` builder enumerating `Account` fields | enumeration ignored a key it did not list | a **new** field (`excluded` never reaching the engine) |

TypeScript catches none of them: excess-property checks do not fire through a spread, and `Partial<Account>` accepts a key whether or not the body reads it.

**Ruling, two parts:**

1. **Test builders spread their overrides last** — `const { priority, ...overrides } = o; return { ...defaults, ...overrides }` — so a field added to the type propagates for free.
2. **Production code that spreads a typed object keeps its type-derived fields in ONE object** (`typeDerived()`), and a test enumerates that object's keys, because the compiler cannot.

Neither is optional going into items 6–10, all of which add fields to types the fixtures spread over.

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

## Also confirmed

- **The build prompt's order wins** over the design package README's BUILD ORDER block, which uses its own numbering. Read the README's order as already-translated.
- **The design package's "Do not change" list is partly superseded** — by item 10 (OUT column, cash-zero figure), item 5 (Exclude button on the card face), and item 1 (the name field's placeholder). Each is sanctioned by its own section. Where an item's section and the do-not-change list disagree, **the item wins.**
- On names: `applyTypeDefaults()` does **not** touch the name on a type change. Never overwrite a name the user typed. Superseded in part by ruling (l) — there is no prefill to re-apply, so an unnamed account simply keeps falling back to whatever the new type is called.

---

## Closed — nothing open

~~**The feedback destination URL (item 9 only).**~~ **Closed by ruling (r):** the feedback link is dropped, so there is no URL to supply. Item 9 ships the privacy line alone.
