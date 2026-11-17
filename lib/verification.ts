/** What the portal says about a MahaSetu outcome. Pure functions, safe to import anywhere. */
export type Tone = "ok" | "bad" | "warn" | "neutral";

const OUTCOMES: Record<string, { title: string; text: string; tone: Tone; status: "VERIFIED" | "NOT_VERIFIED" | "INCOMPLETE" | "NOT_REQUESTED" }> = {
  VERIFIED: { title: "Verified", text: "MahaSetu confirmed every requirement.", tone: "ok", status: "VERIFIED" },
  FAILED_CHECK: { title: "Not verified", text: "One or more requirements were not met.", tone: "bad", status: "NOT_VERIFIED" },
  PARTIAL: { title: "Partly verified", text: "Some checks passed, but others could not be completed yet.", tone: "warn", status: "INCOMPLETE" },
  INSUFFICIENT_DATA: { title: "Not enough information", text: "A department had no record for you, or was not checked.", tone: "warn", status: "INCOMPLETE" },
  PROVIDER_ERROR: { title: "Could not be completed", text: "A department was unavailable. Nothing was marked as failed; try again later.", tone: "warn", status: "INCOMPLETE" },
  MANUAL_REVIEW: { title: "Needs a manual check", text: "A record did not match your details.", tone: "warn", status: "INCOMPLETE" },
  ACCESS_DENIED: { title: "Nothing was verified", text: "No department was given permission, so no records were fetched.", tone: "neutral", status: "INCOMPLETE" },
  RULES_NOT_CONFIGURED: { title: "Not available yet", text: "No approved rules exist for this scheme yet.", tone: "neutral", status: "INCOMPLETE" },
  CANCELLED: { title: "Cancelled", text: "The verification was cancelled.", tone: "neutral", status: "NOT_REQUESTED" },
};

export const outcome = (state: string) => OUTCOMES[state] ?? OUTCOMES.PARTIAL;
/** Application verification_status for a MahaSetu terminal state. */
export const statusFor = (state: string) => outcome(state).status;

export type Reason = { message: string; outcome: "FAIL" | "NEEDS_REVIEW"; provider_id: string };
/** Failures first, then unresolved items; identical messages are listed once. */
export function reasonsOf(checks: { provider_id: string; outcome: "PASS" | "FAIL" | "NEEDS_REVIEW"; message: string }[]): Reason[] {
  const seen = new Set<string>();
  const out: Reason[] = [];
  for (const wanted of ["FAIL", "NEEDS_REVIEW"] as const) {
    for (const c of checks) {
      if (c.outcome === wanted && !seen.has(c.message)) {
        seen.add(c.message);
        out.push({ message: c.message, outcome: wanted, provider_id: c.provider_id });
      }
    }
  }
  return out;
}
