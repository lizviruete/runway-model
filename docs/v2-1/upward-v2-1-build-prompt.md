# Upward V2.1 — Build Prompt (rev. 2026-08-19)

Paste this into a fresh Claude Code session at the root of the `runway-model` repo.

> **Supersedes the first version of this file.** Changes: item numbering now maps explicitly to the design package, design decisions are folded in, item 5b (third chart view) is out of scope, and a new item 10 was added.

---

## Read this first — you have a design package

A completed design-to-dev package accompanies this build:

- `v2-1-design-package/upward-v2.1-handoff/Upward V2.1 Dev Package.html` — **source of truth.** Open in a browser. Contains the visual mockups.
- `v2-1-design-package/upward-v2-1-dev-package.md` — text extraction for grepping and pasting. No mockups.

**The two documents number their items differently.** The design package covers only items that needed design, numbered 1–7. This build prompt numbers all work, 1–10. Use this map:

| Build item (here) | Design package section |
| --- | --- |
| 1 · Account display-name fallback | *none — no design needed* |
| 2 · Expense model unification | **§1** Expense model unification |
| 3 · Per-account rate of return | **§2** Per-account rate of return |
| 4 · Penalty-free date | **§3** Penalty-free date |
| 5 · Account include / exclude | **§4** Include / exclude |
| 6 · Graph by account, as columns | **§5** Graph by account, as columns |
| 7 · Cash flow, positive or negative | **§6** Cash flow, positive or negative |
| 8 · De-personalized example scenario | *none — content change* |
| 9 · Footer privacy line | **§7** Feedback link placement — *placement and geometry only; the link itself is dropped, see ruling (r)* |
| 10 · Calm color pass | **Appendix**, observations 1 and 2 |

**Design package §5b (a third "Drawdown by account" chart view) is OUT OF SCOPE.** It is carried forward to V3. Do not build it. Do not add the `--chart-income` token. See Out of scope.

Where the design package specifies redlines, states, copy, accessibility, or responsive behavior, **follow it exactly** — the copy is final, not placeholder. Where this prompt and the design package disagree, this prompt wins; those cases are called out below.

---

## Context

**Upward** is a transition-stage financial runway model. Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel at `upward.lizbuilds.ai`. No backend: state lives in URL-encoded params plus `localStorage`. The simulation engine is pure and UI-free, covered by a Vitest suite (~121 tests).

This is **V2.1**, a correctness-and-credibility release driven by a review from Chris Wiethe, a practising financial advisor. He did not re-litigate any of his V1 critiques, which means the audit ledger, dollars-not-percentages, and per-account tax and tap order all landed. His feedback moved up a level: he critiqued Upward **as a financial model rather than as a prototype**.

**Before you start:** read the existing engine, state-encoding, and test files to understand current conventions. Match them. Do not restructure anything not named here.

### Working conventions

- **One PR per numbered item, individually QA'd.**
- All existing tests must pass. Add tests for every item.
- The engine stays pure and UI-free. Business logic does not move into components.
- **Show the work.** Every modelled assumption is visible, labelled, and editable. Never a black box.
- **Leave people steadier than you found them.** This tool is used by people who just lost their income. Nothing should scold.

### Build order

1. **Item 1** — P0 defect, standalone, unblocks trust in the ledger.
2. **Item 2** — the schema change. Everything downstream reads from the expense primitive, so land it early.
3. **Items 3 + 4 together** — one shared expandable "Assumptions" panel serves both. Build as one component.
4. **Item 5** — touches card, chart, and ledger. Land before item 6 so the chart is built with excluded state in hand.
5. **Item 6** — the chart.
6. **Item 7** — the cash-flow signal.
7. **Items 8, 9, 10** — any time; independent.

**Engine note that removes an ordering trap:** the monthly **net** figure (in − out) is a trivial pure derivation. Compute it in the engine as part of item 2, not as part of item 7's presentation work. Both the chart tooltip (item 6) and the ledger NET column (item 7) then read from the same source, and the build order above stops mattering for that value.

---

## 1 · P0 — Account display-name fallback

**Defect.** An account whose name field is empty drops out of the chart legend entirely and renders an unlabeled row in the ledger. The account is still computed and still plotted in the correct tap-order position; only its label is missing. This is what Chris saw, and he reasonably read an unlabeled row wedged between two named ones as an *ordering* fault.

**Reproduce:** add an account, pick a type, leave the name blank, save. The legend omits it while the chart still renders its band. The expanded month in the ledger shows an unlabeled `open $X close $X` row.

**Fix.**

- Introduce one shared display-name accessor, e.g. `accountDisplayName(account)`, returning the user's name when non-empty and falling back to the account **type** label otherwise.
- Route the chart legend, the chart series, and the ledger rows through that one accessor so they cannot diverge again.
- ~~Prefill the name field from the selected type on account creation, still fully editable. Fallback and prefill are complementary; do both.~~ **Struck — see ruling (l).** The prefill is not built: it bakes in a name that goes stale on a type change and cannot be told apart from one the user typed. `newAccount()` keeps `name: ""` for every type; the fallback plus the card's placeholder cover the need with no new state.
- Per design package §5: never fall back to "Account 4" and never omit. Two unnamed accounts of the same type get a trailing index — "Brokerage / investment (2)".

**Tests.** Blank name renders the type label in legend, series, and ledger. Renaming updates all three. Whitespace-only names are treated as empty. Duplicate-type indexing.

**Also add regression coverage for ordering**, which is currently untested and is what let this hide: after any sequence of add / remove / reorder, assert that account-panel order, chart legend order, chart series order, and expanded-month ledger row order **all agree**. A stale-render or caching fault on reorder has not been ruled out.

---

## 2 · Expense model unification (schema change)

→ **Design package §1.** Follow its row anatomy, meta-line signals, redlines, states, and copy exactly.

**Change.** Collapse housing, target spend, and added expenses into one primitive:

```
{ id, label, amount, cadence: 'recurring' | 'one-time',
  starts, ends?, stepChange?: { from, newAmount }, isEstimate, seeded }
```

Housing and living spend become pre-seeded lines, pinned as the first two rows, not deletable and not reorderable. That is the only difference from a user-added row — **a position, not a capability.** The bespoke housing "changes later" checkbox is deleted; the general step change replaces it on every line.

**Editing is inline.** The always-visible amount input is the point of the whole item: if the amount field ends up behind a modal, the item failed. The existing Add expense modal survives for **creation only** — creation needs six decisions and an atomic commit; editing needs one keystroke.

**Copy change, confirmed:** "Target monthly spend" becomes **"Living spend"**. A target is something you can fail.

**Preserve the `≈` convention.** Living spend is an estimate, housing is an entered input. The `isEstimate` flag carries this. Per §1, the `≈` glyph is decorative — the estimate fact is carried by the word "estimate" in the meta line and by the aria-label. Color never carries it alone.

**Schema migration — required.** This breaks the URL-encoded state and `localStorage` shape, so saved baselines, saved scenarios, and previously shared `?s=` links must keep working.

- Add a **version field** to the encoded state. Treat missing/unknown as v1.
- Write a v1 → v2 migration mapping the old housing field (plus its "changes later" pair) and the old target-spend field onto the new expense lines.
- **Always migrate on decode**, before state reaches the engine, so the rest of the codebase only sees the current shape.
- Build the migration harness so later versions chain onto it. Items 3, 4, and 5 all add fields; they add them with defaults on top of this foundation rather than each inventing its own compatibility handling.

**Also in this item:** compute the monthly **net** (in − out) in the engine. See the engine note above.

**Tests.** v1 → v2 migration for plain housing, housing with a step change, target spend, and a full realistic saved scenario. Round-trip encode/decode at v2. A real v1 `?s=` payload still loads and produces the same runway it did before. Step change and end date boundary months. Zero added expenses and a dozen.

---

## 3 · Per-account rate of return

→ **Design package §2.** Follow its Assumptions-panel spec, face copy, and states.

**Note this partly exists.** High-yield savings already earns a hardcoded yield, surfaced as `≈ Interest +$13` in the ledger and "earns ≈ $13/mo at this balance" on the card, computed on the opening balance and added as a monthly inflow. **Match that mechanic exactly.** Do not invent a second compounding convention.

- **Eligible types:** high-yield savings (make the existing rate editable), brokerage / investment, Roth retirement, pre-tax retirement, other.
- **Not eligible:** everyday checking, plain savings.
- **Do not touch** the credit line / HELOC interest rate. That is a *cost on a liability*, conceptually and visually distinct from a *return on an asset*.

**Defaults** are pre-filled, not blank, defined as named constants in **one** place. Per §2, the face states `assumes {r}%/yr` when default and `your rate: {r}%/yr` when changed, with a "Reset to default" affordance. A default is an assumption the user did not make: it must be labelled, reversible, and never silently changed.

**Tests.** Compounding matches the existing high-yield-savings convention exactly. Zero and blank rates behave identically. Returns apply only to eligible types. Returns interact correctly with withdrawals in the same month. Default-vs-changed face copy.

---

## 4 · Penalty-free date on pre-tax retirement accounts

→ **Design package §3.** Follow its status-line states verbatim — the copy is final and it is the honesty mechanism for this item.

One optional **month/year** field, pre-tax retirement accounts only, in the same Assumptions panel as item 3 (second row, under the return). Blank = the 10% penalty applies throughout. A past month = it never applies. A future month = it waives from that month forward.

**The status line is mandatory and always present.** It restates the consequence in months — "Penalty applied Aug 2026 – Feb 2027, then waived" — so nobody has to reason about the rule to confirm the field did what they meant. The "isn't tax advice" clause rides on this line and nowhere else: no banner, no asterisk, no legal block.

**Do not "simplify" this to a toggle.** Age here is a **lever**, not a demographic fact. There is no global age input because Upward collects nothing and a global field invites collection it has decided not to do. A checkbox was rejected because it cannot express someone crossing 59½ **mid-projection**, which is exactly the case producing wrong numbers today.

Field renders only for `type === 'pretax'`. Changing type away discards the value and the status line confirms it.

**Tests.** Blank, past, and future dates. A withdrawal in the exact crossing month. A projection spanning the crossing, asserting penalty applied before and waived after. A month set after the horizon end. Existing pre-tax ordinary-income treatment unchanged in all cases.

---

## 5 · Account include / exclude toggle

→ **Design package §4.** Follow its treatment exactly.

The organizing idea: **an excluded account loses its tap-order number.** The number is its place in the drawdown sequence, and something not in the sequence cannot have one. That single fact reads on the card, in the legend, and in the ledger without inventing any new color. Remaining accounts renumber immediately.

The control is a text button on the card **face**, left of the ×. Not behind the caret — a state that changes the headline number must not be reachable only by disclosure.

Excluded accounts keep their balance and settings, are skipped by tap order, and are omitted from the runway. Inputs stay fully legible at 100% opacity: this is not disabled data, it is real money held aside.

**Decision folded in, not in the design package:** an excluded account's balance is **frozen** while excluded — no return compounds on it in stored state. Silent growth on an account the user has set aside is a correctness bug waiting to happen. Re-including restores the balance as it was.

**Tests.** Excluding shortens runway as expected. Excluded accounts absent from tap order, chart series, and ledger totals. Renumbering. Re-including restores the prior result **exactly** (this is the freeze test). Excluding every account is handled gracefully. Interaction with item 3: an excluded account with a non-zero return does not grow.

---

## 6 · Graph by account, as columns

→ **Design package §5.** Follow its palette, geometry, axis, tooltip, and edge states exactly. **Ignore §5b entirely.**

Stacked **columns**, one series per account, Net liquid retained as an overlay line. The data is monthly buckets; area implies interpolation the model does not compute.

**Read §5's "stock, not flow" section before writing chart code.** A column's height is the money still in the accounts at the end of that month — a balance, not that month's spending. Because columns invite the flow reading, the y-axis title ("Balance at month end") and the view subhead are **not optional**; they are the cost of moving off area.

**Palette:** the ten values in §5 (`--chart-series-1…8`, `--chart-liability`, `--chart-net`) are the **only** token additions in this release. Everything else reuses existing values. The alternating dark/light-by-tap-position scheme is deliberate — adjacent bands differ in luminance as well as hue, which is what survives grayscale and dichromatic vision. Light fills carry the 1px stroke of their dark partner; it is load-bearing, not decoration.

> **Where the values live — amended, see ruling (x).** The ten tokens are declared in **`lib/engine/chartSeries.ts`** (`SERIES_HEX`, `LIABILITY_HEX`, `NET_HEX`) and projected onto the chart's root element as real `--chart-*` custom properties by `chartTokenStyle()`. They are **not** declared in `globals.css`: Tailwind v4 strips custom properties no CSS rule references, so a stylesheet declaration read only from TypeScript is silently removed — which shipped an all-black chart past a clean build. TypeScript has to hold the hex values regardless, because the palette validator reads them.
>
> "Only the ten `--chart-*` tokens" still holds exactly. Only their home moved.

**Do not add `--chart-income`.** That belongs to §5b, which is out of scope.

**Toggle rename, confirmed:** the existing two views become **"Balances · total"** and **"Balances · by account"**. The current labels distinguish the split but not the quantity, so both read as "the chart" and either can be misread as flow. Do **not** add a third segment.

Legend order is tap order, always, including excluded accounts in position. Reordering an account card reorders the legend and the stack in the same frame.

**Tests.** Legend order matches tap order after reorder. All §5 edge states: cash-zero marker placement, flat tail after depletion, excluded accounts, single account, never-depletes-in-horizon, all-excluded, negative stack from a drawn HELOC.

---

## 7 · Cash flow, positive or negative

→ **Design package §6.** The copy there covers every state and is final.

One **summary line** above the ledger carrying burn rate and turnaround month. A new **NET column** carrying per-month magnitude in neutral type. Emphasis exists in exactly one place: the month the sign changes.

**Do not ship a first pass with per-row color.** A wall of danger-colored numbers restating a fact the user already knows, to someone in financial distress, fails the calm principle outright. Green-for-positive is rejected on the same logic inverted: if positive is rewarded with color, negative is punished by its absence. The turnaround month is marked by a **word**, not a hue.

The NET column uses no color coding at all — sign, caret, magnitude, tabular. It is therefore unaffected by any form of color blindness.

The summary bar sits in an `aria-live="polite"` region so pulling a lever announces the new burn rate and turnaround month. That is the fastest possible answer to "did that help?" without sight.

Monthly CSV gains a `net` column. No other export change.

**Tests.** Net arithmetic including estimates and yields. Every copy state in §6: turns positive, never positive, positive throughout, turns negative, varies month to month (the range case), exactly zero. Sign handling at zero. The month income resumes.

---

## 8 · De-personalized example scenario

**Problem.** The built-in example mirrors the author's real financial *structure* — a HELOC, a rental-property sale lever, specific IRA splits. The portfolio site links here.

**Change.** Rebuild the example seed with exactly **three** generic accounts:

- **Everyday checking** — the neutral baseline.
- **High-yield savings** — so the example demonstrates rate of return (item 3).
- **401k / pre-tax retirement** — so the example demonstrates the penalty-free date (item 4).

Remove the HELOC, the rental / major-asset-sale lever, the brokerage, and the Roth and pre-tax IRA split **from the example**. The account types stay supported in the product; they simply leave the demo.

**Keep the roughly nine-month crunch.** The tension is what makes the levers worth pulling. Do not soften it into a comfortable scenario. Choose round, obviously-illustrative numbers that no one would mistake for a real person's finances.

**Tests.** Loads to approximately the intended runway. Contains no HELOC, rental, brokerage, or IRA-split accounts. `?example=1` still works. Loading an example remains ephemeral — previewing never overwrites saved data.

---

## 9 · Footer privacy line

→ **Design package §7**, for the placement and geometry only.

> **Rewritten — see ruling (r).** The feedback link is dropped: no link, no external form, no new-tab behaviour. What ships is the privacy line alone.

One line in a **page footer below the ledger card**: *"Your numbers stay in this browser. Nothing is uploaded."* Take §7's treatment — left-aligned to the content column, 40px below the ledger, 13px `#6b7280`. Merged into the existing footer, not stacked beside it (ruling h), and hidden under `?chrome=min` with the rest of `data-chrome`.

The line stands on its own. §7 paired it with the feedback link on the reasoning that a link is where a no-backend product invites the suspicion something is being sent — but the *product* raises that question by asking for account balances. The link was only what prompted saying it out loud.

No modal, no backend, no data capture, no event tracking. The real in-app feedback and support surface is V3, designed alongside the analytics rather than bolted on as a placeholder link.

---

## 10 · Calm color pass

From the design package **appendix**, observations 1 and 2. Both surfaces were on the original do-not-change list; they are now explicitly **in scope** and removed from that list.

**a. Stop colouring by SIGN in the ledger.** — *widened, see ruling (z).*

> The original scope was "demote the OUT column". QA of item 7's never-positive state found that too narrow. `LedgerView`'s `Amount` component colours by sign (`value < 0 → text-red-600`), so once a scenario depletes, **OPENING and CLOSING go red on every row too**:
>
> | OPENING | IN | OUT | NET | CLOSING |
> | --- | --- | --- | --- | --- |
> | red | — | red | neutral | red |
>
> Item 7's one calm column sits between three loud ones, which is why its restraint is invisible on the page.

**The sign is already in the number and the direction is already in the column header. Colour adds only alarm.** That is the same argument that made NET neutral, applied consistently instead of to one column.

`Amount` is used in **five** places — the OPENING and CLOSING cells, the per-account `open`/`close` figures inside an expanded month, and the Transactions view's amount column. All of them stop colouring by sign.

*Deliberately not changed:* the IN column stays green, and the category pills inside an expanded month keep their green/red treatment. Those encode a **category** (money in, money out), not the sign of a running balance — a distinction the widened rule turns on.

**b. Soften the cash-zero date.** The CASH-ZERO DATE stat-card figure is the largest red element in the product and, for the primary user, the most anxiety-loaded number on the page. Render the **figure** in near-black (`#111827`), same size and weight.

**The red dashed cash-zero marker in the chart stays red.** That is where the alarm belongs — it is a marker on a timeline, not a headline. The information is unchanged; only the emotional register moves.

*Flag for review rather than change:* with cash-zero neutral, the green VS. BASELINE figure becomes the only colored stat card. If vs-baseline can render a worse-than-baseline state, note how it currently does so and surface the inconsistency. Do not resolve it.

**Tests.** No functional change; assert the cash-zero *value* and the chart marker are unchanged, and that only presentation moved.

**Not in scope, recorded so it does not get re-proposed:** capping or truncating the ledger in the never-positive state. See ruling (aa) — the perceived heaviness is colour, not row count.

**Deferred until after this item:** the never-positive summary line's copy. See ruling (bb) — it is being judged above three red columns today, so re-judge it once they are neutral.

---

## Out of scope — do not build

- **Design package §5b** — the third "Drawdown by account" chart view, the `--chart-income` token, and the third toggle segment. Carried forward to V3, where it pairs with the recovery module. The §5b *toggle rename* is in scope (item 6); the *third view* is not.
- Any backend, auth, user accounts, or server-side persistence.
- **PostHog or any analytics instrumentation.** Deliberately V3, where it will be designed around the Clarity Lift metric rather than bolted on.
- The AI copilot, goal-seek / "by when" mode, plan-versus-actual drift tracking, and the recovery module.
- New account types: company stock / RSUs, HSA, CD / treasury. On the V3 roadmap.
- Household variation, MCP or API connectivity, white-label or advisor branding.
- Any LizBuilds brand harmonization. See the design package appendix for why the chart palette in particular should be treated as a permanent exception.
- Any change to V1. It is a relic.

**Everything on the design package's "Do not change" list still holds**, with the exceptions named in item 10 — sign-colouring throughout the ledger (ruling z) and the cash-zero date figure.

---

## Definition of done

- All previously existing tests pass, plus new coverage for every item.
- A real v1 `?s=` link still loads and produces the same runway it produced before the migration.
- Housing and living spend are still editable in one click, with no modal.
- Excluding an account and re-including it restores the prior result exactly.
- The example scenario contains nothing traceable to the author's real financial structure.
- Every modelled assumption introduced here is visible, labelled as an assumption, and editable.
- Only the ten `--chart-*` tokens were added — declared in `lib/engine/chartSeries.ts` and projected onto the chart root, per ruling (x). No new spacing, radius, or type values.
- Nothing in the interface reads as scolding.
