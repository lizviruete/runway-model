"use client";

// =============================================================================
// The shared Assumptions panel — design package §2 (expected return) and §3
// (penalty-free date).
//
// ONE component serving both fields, per ruling (e): they live in the same
// panel, the return first and the penalty-free month second, so there is one
// place a user goes to see what Upward is assuming about an account.
//
// The word "Assumptions" does the work a tooltip would do badly. "Show the
// work" cannot depend on hover — tooltips are invisible on touch and to anyone
// who does not think to ask.
// =============================================================================

import { useId } from "react";
import { useNumericInput } from "./useNumericInput";
import {
  isDefaultRate,
  isRateInRange,
  penaltyStatusLine,
  RETURN_RANGE_ERROR,
  returnHelper,
} from "@/lib/accountAssumptions";
import { accountDisplayName } from "@/lib/engine/accountName";
import {
  defaultExpectedReturn,
  supportsExpectedReturn,
  supportsPenaltyFreeMonth,
} from "@/lib/engine/defaults";
import type { Account, ScenarioTimeline } from "@/lib/engine/types";
import {
  percentToText,
  sanitizeSignedPercentText,
  textToSignedPercent,
} from "@/lib/numberInput";

interface Props {
  account: Account;
  timeline: ScenarioTimeline;
  onPatch: (patch: Partial<Account>) => void;
}

export function AssumptionsPanel({ account, timeline, onPatch }: Props) {
  const rateId = useId();
  const monthId = useId();
  const helperId = `${rateId}-helper`;
  const statusId = `${monthId}-status`;

  // A text BUFFER is mandatory here, not a nicety. Bound straight to the number,
  // the intermediate states a negative rate passes through — "-", "-0." — are
  // not representable: typing "-" parses to 0, React re-renders the field as
  // "0", and the minus sign vanishes before the digits arrive. The rate then
  // silently comes out positive, which is the exact failure supporting
  // negatives was meant to prevent. (Caught in the live app, not by a test.)
  //
  // Declared before the eligibility check below because hooks cannot sit after
  // a conditional return.
  const rateInput = useNumericInput({
    value: account.expectedReturn,
    toText: percentToText,
    sanitize: sanitizeSignedPercentText,
    parse: textToSignedPercent,
    onChange: (expectedReturn) => onPatch({ expectedReturn }),
    inputMode: "decimal",
  });

  // Ineligible types show NO panel at all rather than a disabled field — an
  // empty greyed input reads as broken.
  if (!supportsExpectedReturn(account.type)) return null;

  const atDefault = isDefaultRate(account);
  const inRange = isRateInRange(account.expectedReturn);
  const showMonth = supportsPenaltyFreeMonth(account.type);

  return (
    <section
      aria-label={`Assumptions for ${accountDisplayName(account)}`}
      className="mt-3 border-t border-zinc-100 pt-3"
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Assumptions
        </h4>
        {/* A default is an assumption the user did not make: it must be
            labelled, REVERSIBLE, and never silently changed. Absent while at
            the default — there is nothing to reset. */}
        {!atDefault ? (
          <button
            data-testid="assumption-reset"
            onClick={() => onPatch({ expectedReturn: defaultExpectedReturn(account.type) })}
            className="shrink-0 text-[11.5px] text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
          >
            Reset to default
          </button>
        ) : null}
      </div>

      {/* ---- row 1: expected annual return (§2) ---- */}
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={rateId} className="text-[13.5px] text-zinc-700">
          Expected annual return
        </label>
        <div
          className={`flex h-8 shrink-0 items-center rounded-lg border bg-white focus-within:border-zinc-500 ${
            inRange ? "border-zinc-300" : "border-red-700"
          }`}
        >
          <input
            id={rateId}
            data-testid="assumption-return"
            type="text"
            aria-describedby={helperId}
            {...rateInput}
            className="w-24 bg-transparent px-2 text-right text-sm tabular-nums text-zinc-900 outline-none"
          />
          <span className="pr-2 text-xs text-zinc-400">%</span>
        </div>
      </div>
      <p id={helperId} className="mt-[7px] text-[12.5px] leading-relaxed text-zinc-500">
        {inRange ? returnHelper(account) : RETURN_RANGE_ERROR}
      </p>

      {/* ---- row 2: penalty-free date (§3), pre-tax only ---- */}
      {showMonth ? (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={monthId} className="text-[13.5px] text-zinc-700">
              Penalty-free after <span className="text-zinc-400">(optional)</span>
            </label>
            <div className="flex shrink-0 items-center gap-2">
              <input
                id={monthId}
                data-testid="assumption-penalty-month"
                type="month"
                aria-describedby={statusId}
                value={account.penaltyFreeMonth ?? ""}
                onChange={(e) => onPatch({ penaltyFreeMonth: e.target.value || undefined })}
                className="h-8 w-[120px] rounded-lg border border-zinc-300 px-2 text-sm tabular-nums text-zinc-900 outline-none focus:border-zinc-500"
              />
              {/* A clear affordance appears only when the field is set. */}
              {account.penaltyFreeMonth ? (
                <button
                  onClick={() => onPatch({ penaltyFreeMonth: undefined })}
                  className="text-[11.5px] text-zinc-500 underline underline-offset-2 hover:text-zinc-900"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-[7px] text-[12.5px] leading-relaxed text-zinc-500">
            Withdrawals from this account before age 59½ carry a 10% penalty. If you reach 59½
            during this projection, enter that month and Upward stops applying the penalty from
            then on. Leave it blank and the penalty applies the whole way.
          </p>
          {/* THE STATUS LINE — mandatory and always present. It restates the
              consequence in months so nobody has to reason about the rule to
              check the field did what they meant. "It isn't tax advice" rides
              on this line and NOWHERE else: no banner, no asterisk, no legal
              block. */}
          <p
            id={statusId}
            data-testid="assumption-penalty-status"
            aria-live="polite"
            className="mt-2 rounded-lg bg-zinc-50 px-2.5 py-2 text-[12.5px] leading-relaxed text-zinc-700"
          >
            {penaltyStatusLine(account, timeline)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
