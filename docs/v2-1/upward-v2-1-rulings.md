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

## h · Feedback link — merge into the existing footer, hide under `?chrome=min`

**Destination URL: pending from Liz** (see the note at the end). Build the rest against a placeholder constant so this does not block.

- **Merge, do not stack.** One footer. The existing "Sample data is fictional. Not financial advice." disclaimer, the feedback link, and the privacy line live together in the current footer element. Take the spec's left alignment and 40px spacing.
- **Yes, it hides under `?chrome=min`** with the rest of `data-chrome`. That mode is the embedded view used by the gated portfolio page, and a feedback link inside an embed is wrong — it belongs to the full app.

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

## Also confirmed

- **The build prompt's order wins** over the design package README's BUILD ORDER block, which uses its own numbering. Read the README's order as already-translated.
- **The design package's "Do not change" list is partly superseded** — by item 10 (OUT column, cash-zero figure), item 5 (Exclude button on the card face), and item 1 (the name field's placeholder). Each is sanctioned by its own section. Where an item's section and the do-not-change list disagree, **the item wins.**
- On names: `applyTypeDefaults()` does **not** touch the name on a type change. Never overwrite a name the user typed. Superseded in part by ruling (l) — there is no prefill to re-apply, so an unnamed account simply keeps falling back to whatever the new type is called.

---

## Still open — needs Liz

**The feedback destination URL (item 9 only).** This does **not** block item 1; item 9 is eighth in the build order. Build against a placeholder and swap it in before that PR.

Recommendation: a short Google Form rather than a `mailto:`. A form gives structured responses and avoids publishing a scrapable address on a page linked from the portfolio.
