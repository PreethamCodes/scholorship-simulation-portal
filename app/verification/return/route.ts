import { NextResponse } from "next/server";
import { z } from "zod";
import { db, transaction } from "../../../lib/db";
import { identity } from "../../../lib/session";
import { mahasetu, MahaSetuError } from "../../../lib/mahasetu";
import { outcome, reasonsOf, statusFor } from "../../../lib/verification";

export const dynamic = "force-dynamic";

function go(path: string, notice?: string) {
  return new NextResponse(null, { status: 303, headers: { Location: notice ? `${path}?notice=${encodeURIComponent(notice)}` : path } });
}

/**
 * Where MahaSetu sends the applicant back (/verification/return?ref=<transaction>). The address only names a
 * transaction: the outcome is always read from MahaSetu with the portal's own credential, and only for a transaction
 * that belongs to the signed-in applicant, so a forged link cannot mark anything verified.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = await identity();
  } catch {
    return go("/student", "Sign-in is unavailable right now. Please try again.");
  }
  if (!user) return go("/login", "Sign in to see your verification result.");
  if (user.officer) return go("/officer");
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  if (!z.uuid().safeParse(ref).success) return go("/student", "That verification link is not valid.");

  const found = await db().query(
    `SELECT t.application_id, t.status FROM verification_transactions t
       JOIN scholarship_applications a ON a.id = t.application_id JOIN student_profiles s USING (student_ref)
      WHERE t.transaction_ref = $1 AND s.user_id = $2`,
    [ref, user.id],
  );
  if (!found.rowCount) return go("/student", "That verification could not be found.");
  const { application_id: id, status } = found.rows[0] as { application_id: string; status: string };
  const back = "/applications/" + id;
  if (status !== "AWAITING") return go(back, "Your verification result is shown below.");

  let report;
  try {
    report = await mahasetu.results(ref);
  } catch (error) {
    if (error instanceof MahaSetuError && error.code === "REPORT_PENDING")
      return go(back, "Verification was not finished at MahaSetu. You can start it again below.");
    return go(back, "We could not get your verification result right now. Please try again in a moment.");
  }
  const reasons = reasonsOf(report.checks);
  const verdict = outcome(report.state);
  await transaction(async (c) => {
    const locked = await c.query(
      "SELECT t.status FROM verification_transactions t WHERE t.transaction_ref=$1 FOR UPDATE",
      [ref],
    );
    if (locked.rows[0]?.status !== "AWAITING") return; // a repeated visit changes nothing
    await c.query(
      `UPDATE verification_transactions SET status=$2, core_state=$3, passed=$4, failed=$5, needs_review=$6, reasons=$7::jsonb,
              completed_at=now() WHERE transaction_ref=$1`,
      [ref, report.state === "CANCELLED" ? "CANCELLED" : "COMPLETED", report.state, report.passed, report.failed, report.needs_review, JSON.stringify(reasons)],
    );
    const app = await c.query(
      "UPDATE scholarship_applications SET verification_status=$2 WHERE id=$1 RETURNING status",
      [id, statusFor(report.state)],
    );
    await c.query(
      "INSERT INTO application_status_history(application_id,status,actor_id,event,note) VALUES($1,$2,$3,$4,$5)",
      [id, app.rows[0].status, user.id, "MahaSetu verification: " + verdict.title, reasons.map((r) => r.message).join(" ").slice(0, 1000)],
    );
  });
  return go(back, "MahaSetu verification: " + verdict.title + ".");
}
