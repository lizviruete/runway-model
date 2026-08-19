# Upward V2.1 — Dev Package (text extraction)

*Extracted from `Upward V2.1 Dev Package.html` on 2026-08-19 for copy/paste into Claude Code.
The HTML remains the source of truth — it has the visual mockups this cannot carry.
Use this for grepping, quoting specs, and pasting sections into a build session.*

**Numbering warning:** this package numbers its items 1–7 (design items only).
The build prompt numbers items 1–9 (including non-design items). They do NOT line up.
See the mapping table in `upward-v2-1-build-prompt.md` before pasting.

---

DESIGN → DEV HANDOFF
Upward V2.1 — developer package

A diff against shipped V2. Seven items, numbered and named to match your build prompt — paste each section next to its item. Existing card, input, modal, segmented-control, chip and ledger patterns are reused throughout; nothing outside the listed surfaces is restyled, and no LizBuilds brand tokens are applied.

Refinement, not redesign
≈ estimate convention preserved
Zero new spacing values
11 new color tokens (chart palette) — flagged
README — BUILD ORDER
Item 1 — expense primitive. Data-model change; everything downstream reads from it. Ship the model and the inline row before the chart work.
Items 2 + 3 — account assumption fields. One shared expandable panel serves both. Build together, one component.
Item 4 — include / exclude. Touches card, chart and ledger. Land before item 5 so the chart is built with excluded state in hand.
Item 5 — columns + palette. Depends on 4 for edge states and on the accounts panel for legend order. 5b (three views + the new Drawdown chart) reuses all of it and can trail a release.
Item 6 — cash-flow signal. Presentation only; safe to ship last, but do not ship a first pass with per-row color.
Item 7 — feedback link. Ten minutes. Any time.
WHAT TO WATCH FOR
Item 1's whole point is that housing and living spend stay one-click editable. If the amount field ends up behind a modal, the item failed.
Every default rate is an assumption a user did not make. It must be labelled, reversible, and never silently changed.
Exclusion is the highest-risk mechanic in the release — it must be legible on the card, the chart and the ledger, or people will read a wrong runway as a bug.
Item 6 must not arrive as red numbers. Neutral by default, emphasis on state change only.
1 · Expense model unification
2 · Per-account rate of return
3 · Penalty-free date
4 · Include / exclude
5 · Graph by account, as columns
5b · Three views + drawdown
6 · Cash flow, positive or negative
7 · Feedback link
Do not change
Appendix
01
Expense model unification
largest item · IA change

One primitive — label · amount · recurring|one-time · starts · ends? · step change? · isEstimate — for housing, living spend and everything a user adds. The bespoke housing checkbox is deleted and the general step change replaces it.

THE DECISION — INLINE ROWS, SEEDED LINES PINNED

Every expense — seeded or user-added — is the same row component, in one list, with the same affordances: label on the left, an always-visible amount input on the right, a meta line underneath, and a details caret. Editing is inline. Nothing is behind a modal once it exists.

Housing and living spend are the first two rows and cannot be deleted or reordered. That is the only difference, and it is a position, not a capability — so there is no second class of row to learn.

The existing Add expense modal survives for creation only. Creating needs six decisions at once and an atomic commit; editing needs one keystroke on an amount. Different jobs, different surfaces.

WHAT LOST, AND WHY
Generic list, all editing in the modal
Cleanest model, worst product. The two most-touched inputs go from one click to open-edit-save, and the user loses sight of the chart at the moment they are trying to watch it move. This is the regression the brief names.
Keep housing + living as bespoke fields above a generic list
Preserves speed, but ships the problem it was meant to solve: two shapes for one concept, and step change stays bespoke on housing while living spend still cannot have one.
Fully inline, including creation via a blank row
Attractive, but a half-filled row is live input: an unlabeled $0 line recalculates the runway and re-renders the chart on every keystroke, and "cash-zero" flickers while someone types. Creation stays atomic.
MOCKUP — EXPENSES SECTION, INPUTS PANEL (LEFT COLUMN, 386PX)
Expenses
+ Add expense
$10,700/mo now · $6,700 from Sep 2026
Housing / rent
$
2,800
▾
Monthly
·
↘ $1,200 from Sep 2026
≈ Living spend
$
6,500
▾
Monthly
·
estimate
Childcare
$
1,400
▴
Monthly
·
ends Dec 2026
Recurring
One-time
Starts
08/2026
Ends (optional)
12/2026
Amount changes later
This is an estimate (shows as ≈)
Remove
Done
ROW ANATOMY
Row = face (label · amount input · caret) + meta line (cadence · schedule chips) + details drawer (segmented control, starts, ends, step change, estimate flag, remove). The face never changes height when the drawer opens.
AT-A-GLANCE SIGNALS (META LINE)
↘ $1,200 from Sep 2026  step change down, with the month
↗ $3,400 from Jan 2027  step change up
ends Dec 2026  has an end date
one-time · Sep 2026  non-recurring
estimate  paired with the ≈ before the label — same convention as the ledger
ZERO AND DOZEN
Zero added expenses is not an empty state — housing and living spend are always there, so the section is never blank and needs no illustration. Past six rows the list gets a max-height of 520px with internal scroll and a sticky "+ Add expense"; the two seeded rows stay pinned above the scroll area.
REDLINES
row card  1px #e5e7eb · radius 10 · padding 10/12
row gap  8px
face height  34px (input 34, label 14.5/20)
amount input  w 116 · h 34 · radius 8 · 1px #d1d5db · text right · tabular-nums
meta line  12px #6b7280 · margin-top 7
chip  11.5px · #f3f4f6 · radius 5 · padding 2/7
caret hit area  28×28 (visual glyph 11px)
drawer  margin-top 12 · border-top 1px #f3f4f6 · pad-top 12 · field gap 12
open row border  #111827 (existing focus-card treatment)
section header → first row  14px
All values already in use elsewhere in the app (income line cards, modal fields). No new spacing or radius tokens.
STATES
Default — border #e5e7eb, white.
Hover — border #d1d5db; caret glyph #6b7280.
Focus (input) — existing input focus ring, unchanged; row border unchanged.
Focus (caret) — 2px #111827 outline, offset 2, on the 28px hit area.
Open — row border #111827; caret rotates to ▴; drawer expands, no animation over 120ms.
Error — non-numeric or negative amount: input border #b91c1c + helper "Enter a monthly amount, or 0." Row stays open; chart holds last valid value rather than recalculating to NaN.
Disabled — seeded rows have no Remove; the button is absent, not greyed.
Empty — n/a (seeded rows always present).
COPY — FINAL
Section header: Expenses. Sub: $10,700/mo now · $6,700 from Sep 2026 (second clause only when a step change or end date exists in the horizon).
Seeded labels: Housing / rent · Living spend (no longer "Target monthly spend" — it is what you spend, not a target you are failing).
Drawer: Starts · Ends (optional) · Amount changes later → From / New amount · This is an estimate (shows as ≈).
Living spend helper, in drawer: Upward treats this as an estimate. Change the amount any time — it stays an estimate unless you say otherwise.
Caret tooltip / aria: Edit schedule for Housing / rent.
Amount error: Enter a monthly amount, or 0.
ACCESSIBILITY & RESPONSIVE
Caret is a <button aria-expanded> controlling the drawer by aria-controls. Focus order: label → amount → caret → drawer fields → Remove → Done.
The ≈ glyph is decorative; the estimate fact is carried by the word "estimate" in the meta line and by aria-label="Living spend, estimated". Color never carries it alone.
Meta line 12px #6b7280 on #fff = 4.83:1. Green "estimate" #15803d on #fff = 4.6:1.
Escape closes the drawer and returns focus to the caret. Enter in the amount input commits and keeps focus (people tab through amounts repeatedly).
Tablet — panel goes full width above the chart; rows unchanged. Mobile (<640px) — amount input drops to 96px, meta chips wrap to their own line, drawer fields stack to one column. Face stays one line: label truncates with ellipsis at 60% width, full label in title attribute.
02
Per-account rate of return
small

An optional expected annual return on eligible account types, pre-filled with an Upward default, living behind the card's existing caret in a panel labelled Assumptions. The high-yield rate stops being hardcoded and becomes the first entry in that panel.

THE DECISION

The field goes behind the caret, in a panel headed "Assumptions" — the word does the work that a tooltip would do badly. Card faces stay as dense as they are today.

The collapsed face keeps the existing consequence line — earns ≈ $13/mo at this balance — which is already the honest surfacing of the assumption's effect. When the rate is not Upward's default, the face states the rate too: assumes 6.0%/yr · earns ≈ $25/mo at this balance. A user's own number is never hidden from them.

HELOC's interest rate is untouched and stays in its own visual lane: warm text, the word interest, on a liability card. A cost and a return must never share a treatment.

WHAT LOST, AND WHY
Rate input on the collapsed card face
Six to eight cards each grow a second input. The accounts grid becomes a spreadsheet, and a number nobody needs to change most days sits at the same weight as the balance.
Global "expected return" in a settings row
One rate cannot be right for cash and equities at once, and a global control implies Upward knows better than the account. Rejected.
Info icon + tooltip instead of a labelled panel
"Show the work" cannot depend on hover. Tooltips are invisible on touch and to anyone who does not think to ask.
MOCKUP — ACCOUNT CARD, COLLAPSED FACE VS. ASSUMPTIONS PANEL
3
High-Yield Savings
$
4,000
×
High-yield savings
⌄
▴
Savings that earns interest. No tax to withdraw; yield is modeled as a small inflow. · assumes 4.2%/yr · earns ≈ $14/mo at this balance
ASSUMPTIONS
Reset to default
Expected annual return
4.2
%
Upward's default for high-yield savings. Change it to match your account. Applied monthly, before tax.
COLLAPSED FACE — DEFAULT RATE
Taxable investments. Capital-gains tax on the gains portion; no early-withdrawal penalty. · assumes 6.0%/yr · grows ≈ $25/mo at this balance
COLLAPSED FACE — USER-SET RATE
Taxable investments. Capital-gains tax on the gains portion; no early-withdrawal penalty. · your rate: 8.5%/yr · grows ≈ $35/mo at this balance
"your rate" replaces "assumes" the moment the value differs from the default — the only diff on the face.
LIABILITY — UNCHANGED, DO NOT TOUCH
Available credit · Borrowed money. No tax, but monthly interest accrues on the drawn balance starting the month after a draw. · ≈ $71/mo interest per $10k drawn
DEFAULTS, AND ELIGIBILITY
high-yield savings  4.2%
brokerage / investment  6.0%
Roth retirement  6.0%
pre-tax retirement  6.0%
other  0.0%
everyday / checking  — no panel
savings  — no panel
credit line / HELOC  — unchanged
Ineligible types show no Assumptions panel at all rather than a disabled field — an empty greyed input reads as broken.
REDLINES & STATES
panel  margin-top 12 · border-top 1px #f3f4f6 · pad-top 12
rate input  w 96 · h 32 · radius 8 · 1px #d1d5db · right-aligned · suffix % #9ca3af
label  13.5px #374151
helper  12.5px/1.5 #6b7280 · margin-top 7
face rate clause  12.5px #15803d, appended to existing helper with " · "
Default — pre-filled, never blank.
Changed — "Reset to default" appears (absent while at default).
Error — outside −20…40: border #b91c1c, helper "Enter a rate between −20% and 40%." Last valid rate stays in the model.
Zero — 0% is valid and legal; face reads "your rate: 0%/yr · no growth modeled".
COPY — FINAL
Panel heading: Assumptions
Label: Expected annual return
Helper (default): Upward's default for {type}. Change it to match your account. Applied monthly, before tax.
Helper (changed): Your rate. Applied monthly, before tax.
Reset: Reset to default
Face, default: assumes {r}%/yr · grows ≈ ${n}/mo at this balance (savings types keep "earns")
Face, changed: your rate: {r}%/yr · grows ≈ ${n}/mo at this balance
ACCESSIBILITY & RESPONSIVE
Input is type="number" inputmode="decimal" step="0.1", labelled by the visible label; helper wired via aria-describedby so the assumption is announced with the field.
The panel is a region labelled "Assumptions for High-Yield Savings"; the caret button carries aria-expanded.
#15803d on #fff = 4.6:1; #6b7280 on #fff = 4.83:1; #c2410c on #fff = 4.7:1. Green vs. orange is never the only signal — the words "grows"/"interest" differ.
Recalculation is debounced 250ms so a screen reader is not fighting a live-updating runway figure mid-keystroke.
Mobile — panel is full card width; label and input stay on one line (input 88px). Type dropdown, balance and caret order unchanged.
03
Penalty-free date on pre-tax retirement
small · copy is the work

One optional month/year field, pre-tax retirement accounts only, in the same Assumptions panel as item 2 — second row, under the return. Blank means the 10% penalty applies throughout; a past month means it never applies; a future month waives it from that month forward.

MOCKUP — PRE-TAX IRA CARD, ASSUMPTIONS PANEL OPEN
6
Pre-tax IRA
$
3,000
×
Pre-tax retirement (Traditional IRA / 401k)
⌄
▴
Full withdrawal taxed as ordinary income, plus a 10% early-withdrawal penalty. · assumes 6.0%/yr · grows ≈ $15/mo at this balance · penalty-free from Mar 2027
ASSUMPTIONS
Expected annual return
6.0
%
Penalty-free after (optional)
03/2027
▤
Withdrawals from this account before age 59½ carry a 10% penalty. If you reach 59½ during this projection, enter that month and Upward stops applying the penalty from then on. Leave it blank and the penalty applies the whole way.
Penalty applied Aug 2026 – Feb 2027, then waived. Upward models the penalty only — it isn't tax advice.
THE STATUS LINE — ONE PER STATE, ALWAYS PRESENT
Blank — Penalty applied to every withdrawal in this projection. Add a month above if you'll turn 59½ before it ends.
Future month — Penalty applied Aug 2026 – Feb 2027, then waived.
Past month — No penalty applied — you were already past 59½ when this projection starts.
Month after horizon — Penalty applied for the whole projection; the waiver starts after it ends.
The status line is the honesty mechanism: it restates the consequence in months, so nobody has to reason about the rule to check the field is doing what they meant. "It isn't tax advice" rides on this line and nowhere else — no banner, no asterisk, no legal block.
WHY THIS SHAPE (KEEP FOR THE IMPLEMENTER)
Age is a lever here, not a demographic fact — so there is no global age input, because a global field invites collection Upward has decided not to do. A checkbox was rejected because it cannot express someone crossing 59½ mid-projection, which is exactly the case that produces wrong numbers today. Do not "simplify" this to a toggle.
REDLINES · STATES · A11Y · RESPONSIVE
<input type="month"> · w 120 · h 32 · radius 8 · 1px #d1d5db · tabular-nums. Same geometry as the AS OF date input.
Status line: 12.5px/1.5 #374151 on #f7f7f8, radius 8, padding 8/10, margin-top 8. Reuses the panel-note treatment; no new token.
States — empty shows placeholder mm/yyyy; hover/focus per existing input; error is impossible (month input is constrained) — an unparseable pasted value falls back to blank and the status line says so; a clear affordance ("Clear") appears only when set.
Field only renders for type === 'pretax'. Changing type away discards the value and the status line confirms: "Penalty-free month removed with the type change."
aria-describedby points at helper + status line, so a screen reader hears the rule and the resulting month range together. Status line is aria-live="polite".
Mobile — label wraps above the field; field goes full width. Native month picker on iOS/Android is acceptable; do not build a custom one.
04
Account include / exclude
small · highest confusion risk

Hold an account out of the runway without deleting it. One treatment, applied identically in three places, built from one idea: an excluded account loses its tap-order number. The number is the account's place in the drawdown sequence; something not in the sequence cannot have one. That single fact reads on the card, in the legend and in the ledger without any new color.

THE DECISION

Control: a text button on the card face, left of the × — Exclude / Include. On the face, not behind the caret: a state that changes the headline number cannot be reachable only by disclosure.

Excluded card: number chip goes hollow with an em dash, border goes dashed, inputs stay fully legible at 100% opacity (this is not disabled data — it is real money, held aside), and a single gray line states the consequence. Remaining accounts renumber immediately.

A persistent count in the Accounts header is the safety net for the returning user: the header always says how much is held out, so nobody has to remember what they did five minutes ago.

WHAT LOST, AND WHY
Opacity / greying the whole card
Reads as disabled or errored, and makes a balance the user still needs to edit hard to read. Excluded accounts remain fully editable.
A switch labelled "Included in runway"
Upward has no switches. Adding a control vocabulary for one feature costs more than it earns; the text button derives from the existing × / "Start fresh" text-action pattern.
Moving excluded cards to a separate collapsed group
Out of sight is exactly the failure mode named in the brief. Excluded cards stay in place, in the grid, at the end of the tap order.
MOCKUP — THE SAME EXCLUSION IN THREE PLACES
ACCOUNTS
$19,000 counted in runway · $3,000 excluded · drag to set tap order
+ Add account
1
Everyday Checking
$
3,000
Exclude
×
Operating cash you spend from day to day.
—
Pre-tax IRA
$
3,000
Include
×
Excluded — this $3,000 isn't part of your runway. Balance and settings are kept.
IN THE CHART LEGEND
Everyday Checking
Savings
High-Yield Savings
Pre-tax IRA
excluded
Net liquid
Excluded series stay in the legend, in tap-order position, with a hollow dashed swatch and struck-through label. They draw no band. Keeping them listed is what tells a returning user why a band is missing.
IN THE LEDGER (EXPANDED MONTH)
Everyday Checking
open $3,000
Income +$9,000
close $2,700
High-Yield Savings
open $4,000
≈ Interest +$14
close $4,014
Pre-tax IRA
excluded · $3,000 held, not counted
Excluded accounts sort to the bottom of the per-account lines, above a dashed rule, with no open/close figures — because nothing happened to them. CSV exports keep the row with an excluded column so the trail stays auditable.
REDLINES & STATES
card border  1px dashed #9ca3af (was 1px solid #e5e7eb)
card bg  #fcfcfd
chip  22×22 · radius 6 · 1px dashed #9ca3af · glyph "—" 12px #6b7280
action  12.5px underlined · #6b7280 idle / #111827 when excluded · 28px hit height
legend swatch  11×11 · radius 3 · 1px dashed #9ca3af · no fill
ledger rule  1px dashed #e5e7eb · pad-top 7
Hover — action darkens to #111827; card border unchanged.
Focus — 2px #111827 ring on the action.
Drag — excluded cards are not draggable; drag handle shows no grab cursor and the drop indicator skips them.
All accounts excluded — runway reads 0.0 months, chart shows an empty plot with the caption "Every account is excluded. Include one to see a runway." No error styling.
COPY — FINAL
Actions: Exclude / Include
Card line: Excluded — this $3,000 isn't part of your runway. Balance and settings are kept.
Header, nothing excluded: $22,000 in assets · drag to set tap order (unchanged)
Header, something excluded: $19,000 counted in runway · $3,000 excluded · drag to set tap order
"In assets" becomes "counted in runway" only while an exclusion exists — the phrase has to name what the number now means, and a total labelled "assets" that omits assets would be a lie.
Legend: Pre-tax IRA — excluded
Ledger: excluded · $3,000 held, not counted
Tooltip on action: Hold this account out of the runway. Nothing is deleted.
ACCESSIBILITY & RESPONSIVE
Action is a button with aria-pressed; accessible name "Exclude Pre-tax IRA from runway".
The card carries aria-describedby → the "Excluded" line, so the state is announced when focus enters the card, not just seen.
Toggling fires a polite live-region announcement: "Pre-tax IRA excluded. Runway 6.1 months, down 2.2." The runway change is the thing a screen-reader user would otherwise miss entirely.
Dashed border + em-dash chip + struck label + explicit word "excluded" — four non-color signals. Contrast: #6b7280 on #fcfcfd = 4.7:1; dashed #9ca3af border on #fcfcfd = 2.6:1 (non-text, meets 3:1 with the chip glyph as the load-bearing cue).
Tablet — accounts grid 2-up, unchanged. Mobile — 1-up; the action moves to the row under the balance, left-aligned, 13px, so it never competes with × for a thumb. Header wraps to two lines with the excluded clause on the second.
05
Graph by account, as columns
medium

Stacked columns, one series per account, Net liquid retained as an overlay line. The data is monthly buckets; area implies interpolation between months that the model does not compute. Columns are the honest encoding.

MOCKUP — RUNWAY CHART, EXAMPLE SCENARIO (JAN '27 HOVERED)
RUNWAY BY ACCOUNT
Example scenario
Balances · total
Balances · by account
Drawdown · by account
What you have left at the end of each month, split by account in tap order. Baseline — your plan, carried forward, no changes.
$0
$7.5k
$15k
$22.5k
$30k
Balance at month end
cash-zero · Apr 29
Aug '26
Sep '26
Oct '26
Nov '26
Dec '26
Jan '27
Feb '27
Mar '27
Apr '27
depleted
Everyday Checking
Savings
High-Yield Savings
Brokerage
Roth IRA
Pre-tax IRA
Net liquid
Jan 2027
opening $12,500 · closing $7,500
Everyday Checking
$0
Savings
$0
High-Yield Savings
$1,500
Brokerage
$5,000
Roth IRA
$3,000
Pre-tax IRA
excluded
Net liquid
$11,000
Cash flow
−$7,900
Living spend → $5,200 from this month
TOOLTIP — JAN '27 HOVERED
Shown beside the chart here so the mockup stays readable. In the product it follows the cursor at a 12px offset and flips side near the right edge — it never covers the hovered column. The hovered month is marked in the plot above by the band wash and the bolded axis label.
READ THIS BEFORE BUILDING — STOCK, NOT FLOW

A column's height is the money still in the accounts at the end of that month — a balance. It is not the month's spending and not the drawdown. So a column carries one segment per account that still holds money, and a six-account scenario shows six colors in month one, because all six accounts still hold something.

Segments drop out as tap order drains them: tap 1 empties, its color disappears, the stack gets shorter. The number of colors falls over time and never rises. That decay is the drawdown made visible, and it is the same series geometry as today's area chart — the conversion is an encoding change only, not a data change.

It has to stay a stock, because everything anchored to this chart is a stock: the Net liquid overlay is a balance, and cash-zero is the month the stack reaches zero. Neither is expressible on a flow chart.

THE ONE-COLOR-PER-COLUMN READING

A column that stays one color until an account empties is a flow chart: height = that month's spending, segments = which accounts covered it. That is a real and useful chart — it is now the third view below, not a change to this one.

Because columns invite the flow reading — bars usually mean per-period amounts — every view gains an explicit subhead and the balance views gain a y-axis title, "Balance at month end". That labelling is not optional; it is the cost of moving off area.
CHART SPECIFICATION — SERIES PALETTE

The palette alternates dark and light by tap-order position. Adjacent bands in a stack therefore differ in luminance as well as hue, which is what keeps 8 series readable — and readable in grayscale and for dichromatic vision, where a hue-only palette collapses. Light fills carry a 1px stroke of their dark partner so a thin band never disappears against white.

#0f766e
tap 1 · dark
#7dd3fc
tap 2 · light · stroke #0284c7
#4338ca
tap 3 · dark
#f0abfc
tap 4 · light · stroke #c026d3
#be123c
tap 5 · dark
#fdba74
tap 6 · light · stroke #ea580c
#065f46
tap 7 · dark
#86efac
tap 8 · light · stroke #16a34a
#475569
liabilities · out of rotation
#111827
Net liquid line
Beyond 8 accounts the rotation repeats from tap 1 with a 12% lightness shift; a 9th account is rare enough that repetition beats inventing indistinguishable hues. Credit lines / HELOC always draw slate #475569 regardless of position, because a liability is not a peer of an asset — and slate is deliberately the one hue absent from the asset rotation.
Token flag. These ten values are the only additions in the release: --chart-series-1…8, --chart-liability, --chart-net. Everything else in items 1–7 reuses existing values. Net liquid moves from dark green to near-black on purpose: with adjacent color bands, an overlay line has to read as "not a series."
AXIS, GRIDLINES, GEOMETRY
plot height  260px (unchanged from area chart)
y axis title  "Balance at month end" · 11px #9ca3af · rotated −90°
column width  band × 0.62, max 52px, min 8px
column gap  band × 0.38 · no rounded corners (segments must butt)
segment order  tap 1 at TOP of stack (matches today's band order)
y axis  0 → nice-max, 5 ticks, 11px #9ca3af, right-aligned at x−8
gridlines  1px #f1f5f9 · baseline 1px #d1d5db
x labels  11.5px #9ca3af · "Aug '26" · every month ≤14 cols, else every 2nd/3rd
cash-zero  1.5px #dc2626 dashed 4/4, in the GAP before the first $0 column, labelled "cash-zero · Apr 29"
net liquid  2px #111827 + 4px #fff halo, dots at hover only
event dot  r 2.5 #9ca3af, 12px below axis label = a step change or end date lands in that month
HOVER & TOOLTIP
Hover target is the whole month band, not the column — a 12px-tall stack must still be hoverable. Hovered band gets a #f7f7f8 wash behind the full plot height; its axis label goes #374151 600.
Tooltip: month · opening/closing · every series in tap order with swatch and balance · zero balances shown in #9ca3af rather than dropped (their absence is information) · excluded series struck through · footer with Net liquid and Cash flow · a final line naming any event in that month ("Housing → $1,200 from this month", "Childcare ends this month", "Penalty-free from this month").
Follows the cursor with 12px offset, flips side at 260px from the right edge, never covers the hovered column. 150ms fade in, none out.
Keyboard: the chart is one tab stop; ← → move month, Home/End jump to first/last, and the tooltip content is mirrored into a live region so it is announced. Escape leaves the chart.
EDGE STATES — ALL NAMED
Cash-zero marker — drawn in the gap before the first zero column, never through a column, so it reads as a boundary between months rather than an annotation on one. Label sits above the plot, right-aligned to the line.
Flat tail after depletion — zero-height columns are not drawn. The baseline continues as a 2px #9ca3af rule under those months with a single 10.5px #9ca3af "depleted" caption above the first of them, once. No repeated zeros.
Excluded accounts — no band, legend entry retained (hollow dashed swatch, struck label, "excluded"), tooltip row retained. Included balances do not resize to fill the space; the stack simply gets shorter, which is the truth.
Single account — one column series, legend still shown (it names the series), no special casing. Column width still capped at 52px so it does not become a monolith.
Never depletes in horizon — no red marker at all. Caption under the chart: "No cash-zero within this 24-month view." The absence of the marker is the good news; do not substitute a green marker.
All excluded / no accounts — empty plot with axes drawn and one line of copy; no illustration, no dashed placeholder columns.
Negative stack — a drawn HELOC pushes a series below zero: axis extends below the baseline, liability segments draw downward in slate with a 45° hatch, and the baseline stays 1px #d1d5db at true zero.
LEGEND, ACCESSIBILITY, RESPONSIVE
Legend order is tap order, always, including excluded accounts in their position. Reordering an account card reorders the legend and the stack in the same frame — that coupling is the point.
Unnamed accounts fall back to the type label ("High-yield savings"), never to "Account 4" and never omitted. Two unnamed accounts of the same type get a trailing index: "Brokerage / investment (2)".
Legend swatch 11×11 radius 3; label 12.5px #374151 = 8.9:1. Every fill has ≥3:1 against its neighbours in the stack and ≥3:1 against white for the stroked light fills.
Adjacent-pair ratios: teal/sky 3.2:1 · sky/indigo 4.8:1 · indigo/fuchsia 4.5:1 · fuchsia/rose 3.7:1 · rose/orange 3.9:1 · orange/emerald 4.2:1 · emerald/green 5.2:1.
Color never carries meaning alone: the tooltip and legend name every series, and the axis-adjacent event dots are paired with tooltip text.
Tablet — chart full width under the inputs panel; x labels thin to every 2nd month. Mobile — plot height 200px, column min-width 8px, x labels every 3rd month rotated 0° (never diagonal), legend becomes a 2-column grid, tooltip becomes a bottom sheet pinned above the fold on tap. Net liquid line stays 2px.
05b
Three views, and the terminology that separates them

The toggle currently offers Total and By account, which distinguishes the split but not the quantity — so both read as "the chart" and either can be misread as flow. Renaming it around the quantity fixes that, and makes room for the drawdown view.

RECOMMENDATION — THREE, NOT FOUR

Ship three. An account-agnostic drawdown view would be a single-color bar of monthly spending — which is the ledger's OUT column drawn as a rectangle. It adds no fact the summary line and the ledger do not already state, and the whole reason the drawdown view earns its place is which account covered it. Take the split away and nothing is left.

Four views also breaks the toggle: a 2×2 matrix (balance/drawdown × total/by account) needs two controls or four labels that all read alike, and one of the four cells is empty of value. Three segments with a rule between the balance pair and the drawdown one keeps a single control and states the stock/flow break visually.

If the total-drawdown view is wanted later, the cheaper form is a toggle inside the drawdown view that merges the account segments into one — not a fourth top-level view.

NAMING — FINAL
Toggle: Balances · total  /  Balances · by account  /  Drawdown · by account
"Balances" and "Drawdown" are the two quantities; total / by account is the split. The shared word is what tells a user the first two are the same chart seen two ways and the third is a different question.
Why not "Depletion"
Depletion names the endpoint — the moment an account hits zero — which is what the balance views show. The flow view is about the money moving each month, and "drawdown" is the word an advisor already uses for it. If you prefer Depletion, it should swap with cash-zero language, not with drawdown.
Headers & subheads
Runway — What you have left at the end of each month, all accounts combined.
Runway by account — What you have left at the end of each month, split by account in tap order.
Drawdown by account — What you spent each month, and which accounts covered it.
MOCKUP — NEW VIEW 3, DRAWDOWN BY ACCOUNT
DRAWDOWN BY ACCOUNT
Example scenario
Balances · total
Balances · by account
Drawdown · by account
What you spent each month, and which accounts covered it.
$0
$3k
$6k
$9k
$12k
Spent this month
out ≈ $7,900/mo
income covers it from here
Aug '26
Sep '26
Oct '26
Nov '26
Dec '26
Jan '27
Feb '27
Mar '27
Apr '27
Segments stack in tap order. Height is spending, not balance.
Covered by income
Everyday Checking
Savings
High-Yield Savings
Brokerage
Roth IRA — not drawn in this view
TOOLTIP — JAN 2027
Jan 2027
spent $7,900 · income $3,913 · drawn $3,987
Covered by income
$3,913
High-Yield Savings
$1,500
Brokerage
$2,487
High-Yield Savings runs out
this month
Living spend → $5,200 from this month
Only sources that contributed are listed — a zero row here means nothing, unlike the balance views where a $0 balance is information. The "runs out" line is the depletion fact your advisor is looking for, stated in words on the month it happens.
WHAT THIS VIEW ANSWERS THAT THE OTHERS CANNOT
How much of the burn income is actually absorbing — the pale base segment — and how much is coming out of savings. That ratio is invisible in both balance views.
Which account is funding this month, and the month a source hands off to the next one (two colors in one column = a handoff).
Whether spending itself is changing, since the bar top is the month's outflow: a step change or an expense ending moves the top of the bar, which is the one thing the balance views can only show as a change in slope.
And the honest limit: the bar top is nearly flat, so this view says nothing about how long the money lasts. Cash-zero and Net liquid do not appear here. It is a companion to the runway, never the default.
SPEC — VIEW 3
column geometry  identical to views 1–2
y axis  0 → nice-max of monthly out · title "Spent this month"
stack order  income at base, then accounts in tap order upward
income fill  #eef2f6 + 1px #cbd5e1 stroke
account fills  same --chart-series-1…8 as views 1–2, same account = same color across views
out reference  1px #cbd5e1 dashed 3/4 at the median monthly out, labelled right
handoff marker  none — the two-color column IS the marker
no cash-zero line  and no Net liquid overlay
legend  income first, then tap order; never-drawn accounts listed at 35% opacity
Token flag. One addition beyond item 5's ten: --chart-income #eef2f6. Deliberately a near-neutral outside the asset rotation — income is not an account, and it must not compete with one.
EDGE STATES — VIEW 3
Income covers the month — bar is entirely the pale base; no account segments. A single dashed marker and one caption, "income covers it from here", on the first such month only.
After depletion — spending continues with nothing to fund it. The unfunded portion draws as a 45° #d1d5db hatch with a #9ca3af outline, legend entry "Not covered". This is the one place this view beats the balance views outright: it shows the shortfall rather than a flat zero line.
Excluded accounts — never appear as a segment (they fund nothing) and sit in the legend at 35% opacity, struck through, "excluded".
One-time expenses — a spike in the bar top; tooltip names it. The dashed out-reference stays at the median so the spike reads as a spike.
Zero spending — no column drawn, month label retained.
Never draws on accounts — every bar pale; caption "Income covers your spending every month in this view." No empty state needed.
TOGGLE, A11Y, RESPONSIVE, SCOPE
Segmented control gains a third segment and a 1px #d1d5db rule (heavier than the #e5e7eb divider between the balance pair) before Drawdown — the visual statement that a different quantity starts there.
Default view is unchanged: Balances · by account. Selection persists in the URL param alongside the rest of the scenario state.
Control is a radiogroup labelled "Chart view"; each option's accessible name is the label plus its subhead, so the stock/flow difference is announced, not just seen. Arrow keys move between views.
Pale income fill on white is 1.1:1, so its 1px #cbd5e1 stroke is load-bearing and mandatory; the legend and tooltip name it in words. #6b7280 caption on #fff = 4.83:1.
Tablet — three segments still fit on one row at 12.5px. Mobile — the control wraps to two rows (balance pair, then drawdown) rather than shrinking type; plot height 200px as in views 1–2.
Scope note. View 3 is new surface, beyond the brief's item 5. It shares the palette, geometry and tooltip shell with views 1–2, so it is cheap after them — but it can ship a release later without holding item 5 up.
06
Cash flow, positive or negative
small · highest risk of getting it wrong

One summary line above the ledger carries the burn rate and the turnaround month. A new NET column carries per-month magnitude in neutral type. Emphasis exists in exactly one place: the month the sign changes.

THE DECISION

Burn rate is a rate, and a rate belongs in one place, stated once: "Burning about $7,900/mo · turns positive Mar 2027". Repeating it as twelve red numbers does not add information — it adds twelve reminders.

The NET column stays because "which month is worst" is a real question. It is set in #334155 with a small directional caret, sign always explicit, tabular. Deficit is the expected state during an income gap, so it gets the ordinary treatment — ordinariness is the design.

The one thing worth interrupting for is a sign change, because it is invisible today and it is the answer to "when does this turn around". It gets a quiet chip on that row and a named month in the summary. Nothing else is emphasised, ever.

WHAT LOST, AND WHY
Red negative per row
A wall of danger-colored numbers restating a fact the user already knows, to someone in financial distress. Fails principle 2 outright. Not shipped in any form.
Green for positive months
Rejected too, and for the same reason inverted: if positive is rewarded with color, negative is punished by its absence. The turnaround month is marked by a word, not a hue.
Per-row sparkline or bar-in-cell
Twelve mini-charts inside a table that already expands into per-account lines. The shape of the burn is already the chart's job, immediately above. One sparkline in the summary line does the same work once.
"Runway health" score or status word
This is the emotional layer the competitor was torn down for. Upward states quantities and dates; it does not grade the user.
MOCKUP — LEDGER HEADER + NET COLUMN
LEDGER
The auditable trail behind every number
Monthly
Transactions
A forward projection from your as-of date — not a bank statement. Lines marked "≈" are modeled estimates (spend, yield, taxes); the rest are inputs you entered.
Burning about $7,900/mo · turns positive Mar 2027
$1,400/mo less than baseline
MONTH
OPENING
IN
OUT
NET
CLOSING
▸ Oct 2026
$29,427
$3,913
−$7,900
▾ −$3,987
$25,440
▸ Nov 2026
$25,440
$3,913
−$7,900
▾ −$3,987
$21,454
▸ Mar 2027
TURNS POSITIVE
$5,600
$9,100
−$7,900
▴ +$1,200
$6,800
▸ Apr 2027
$6,800
$9,100
−$7,900
▴ +$1,200
$8,000
COPY — EVERY STATE, FINAL
Turns positive in horizon
Burning about $7,900/mo · turns positive Mar 2027
Never positive
Burning about $7,900/mo · no month turns positive in this view
Positive throughout
Adding about $1,200/mo · positive every month in this view
Turns negative
Adding about $1,200/mo · turns negative Jan 2027
Varies month to month
Burning $4,000–$9,300/mo · turns positive Mar 2027 (range when the spread exceeds 25% of the mean)
Exactly zero
NET cell reads $0, no caret, no chip. Summary: "Flat about $0/mo".
Delta (right side)
$1,400/mo less than baseline · $600/mo more than baseline · Same as baseline
Row chips
TURNS POSITIVE · TURNS NEGATIVE · INCOME RESUMES (on the month a recurring income starts; chip only, no NET emphasis)
"About" is deliberate and stays. The number is a projection, and rounding it in language is more honest than a false-precision figure.
REDLINES & STATES
summary bar  1px #e5e7eb · radius 10 · bg #fcfcfd · pad 12/14 · margin-bottom 14
summary text  14.5px #111827 · figures 600 · tabular-nums
delta text  13px #6b7280 · right-aligned
sparkline  96×26 · bars 6px w / 4px gap · #cbd5e1 deficit, #94a3b8 surplus · zero rule #e5e7eb
NET column  14.5px #334155 · tabular · caret 11px #9ca3af, 6px gap
sign-change row  bg #fcfcfd · NET #111827 600
chip  11px 600 · 1px #d1d5db · radius 5 · pad 1/6 · bg #fff
col widths  NET inserted between OUT and CLOSING at 1.05fr; others unchanged
Hover — existing row hover only; NET does not change color.
Expanded month — per-account lines are unchanged; NET is not repeated per account (it is a month-level fact).
Transactions view — no NET column; the summary bar persists above both views.
Empty / no data — summary bar hidden entirely rather than showing "$0/mo".
CSV — Monthly CSV gains a net column; no other export change.
ACCESSIBILITY & RESPONSIVE
#334155 on #fff = 10.4:1; #6b7280 on #fcfcfd = 4.7:1; chip #111827 on #fff = 16.1:1. The NET signal is sign + caret + magnitude — no color coding at all, so it is unaffected by any form of color blindness.
Caret glyphs are aria-hidden; the cell's accessible name is "Net cash flow, minus 3,987 dollars". Chips are real text, read inline with the month.
Summary bar is a <p> in an aria-live="polite" region so pulling a lever announces the new burn rate and turnaround month — the fastest possible answer to "did that help?" without sight.
Sparkline is decorative and hidden from AT; the sentence beside it carries everything it shows.
Tablet — table keeps all six columns; OPENING drops first if needed. Mobile — the wide table becomes stacked month cards: month + chip on line 1, closing balance large on line 2, then a 2×2 of Opening/In/Out/Net at 13px. No horizontal scroll. The summary bar wraps: sentence on line 1, delta on line 2, sparkline hidden below 480px.
07
Feedback link placement
minor

Where: a page footer below the ledger card — the only surface in Upward that isn't a card — left-aligned to the content column, 40px below the ledger, 13px #6b7280, underlined on hover only. It is the last thing on the page because someone has feedback after they have used the model, not before.

How quiet: quieter than "Start fresh". No icon, no button, no chrome, nothing in the header — the header is where the scenario controls live and a feedback link there competes with work. Opens in a new tab so a scenario in progress is never lost.

Paired with a privacy line, because a feedback link is the one place a no-backend product invites the suspicion that something is being sent. Say it plainly, once.

MOCKUP — PAGE FOOTER
…ledger card ends
Send feedback ↗
·
Your numbers stay in this browser. Nothing is uploaded.
13px #6b7280 · margin-top 40 · target _blank rel="noopener noreferrer" · aria-label "Send feedback, opens in a new tab" · hover #111827 + underline
Do not change

Surfaces deliberately left alone. If a diff touches one of these, it is out of scope for V2.1.

Header, tagline, and the scenario / saved-scenario controls
AS OF card and its helper copy
RUNWAY / CASH-ZERO DATE / VS. BASELINE stat cards, including the red cash-zero date and green vs-baseline figure
Income section: salary field, income line cards, Add income modal
"Same as baseline" annotations throughout
Account card face layout: drag order, number chip geometry, name field, balance input, type dropdown, × control
Type dropdown option list and all existing tax-treatment helper text
HELOC / credit-line treatment, including its interest copy and warm color
Ledger IN (green) and OUT (red) columns — see appendix note
Chart view default (Balances · by account) and URL-param persistence
Ledger per-account expanded lines, ≈ pill styling, Monthly / Transactions toggle, both CSV exports
Global type scale, spacing scale, radii, card and input styling
Page background, card borders, shadow treatment
Appendix — on record, not built

Observations from designing this release. None of it is in the specs above.

OBSERVATIONS
The OUT column is already the wall of red that item 6 was written to avoid. Item 6 does not touch it, per the do-not-change list, but the exact argument applies: a red figure on every row of a projection where outflow is expected. Worth a one-line change in a later pass — demote OUT to #334155 and let the NET column carry direction — and it would make item 6's restraint coherent rather than lonely.
The cash-zero date is the app's largest red element. For the primary user it is the single most anxiety-loaded number on the page, rendered in 34px danger red. It is honest, but "calm is the differentiator" and this is the loudest thing in the product. A dark near-black date with a red marker in the chart only would carry the same information with a different emotional register. Not a V2.1 change; worth a decision of its own.
"Target monthly spend" → "Living spend" is the one copy change in item 1 outside the mechanical work. A target is something you can fail. Flagged in case it has meaning I do not know about.
Item 2 and item 4 interact. An excluded account with a return still compounds silently in stored state. Recommendation: hold the balance frozen while excluded, and say so — "Balance and settings are kept" already implies no growth. Confirm before implementing.
EVENTUAL BRAND ALIGNMENT
No LizBuilds tokens were used anywhere in this package, per the brief. For the record, when that harmonization is taken up:
The chart palette is the wrong place to start. It is the most constrained system in the product — eight series, adjacency contrast, colorblind safety. Cream/forest/sage cannot supply eight distinguishable series, so the chart will need its own palette regardless. Treat it as a permanent exception rather than a harmonization failure.
Type is the highest-leverage swap and the cheapest. Newsreader on the three stat-card figures and the page title alone would read as branded, with zero interaction risk. The UI type can stay a system sans indefinitely — a financial model should feel like an instrument, not a publication.
Do not bring cream to the input surfaces. The white-card-on-grey structure is doing real work here: it separates entry from output. Cream fields on a cream page would flatten exactly the distinction the product depends on.
Sequence it after the recovery module, not before. Brand-level decisions are cheaper once the full surface area exists; re-harmonizing twice is the expensive path.
Upward V2.1 · design → dev package · items 1–7, diff against shipped V2