"use server";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { required } from "../lib/session";
import { db, transaction } from "../lib/db";
import { application, UserIssue } from "../lib/applications";
import { launchUrl, mahasetu, MahaSetuError } from "../lib/mahasetu";

const FINAL = ["RECOMMENDED", "REJECTED"];

function message(e: unknown) {
  if (e instanceof UserIssue || e instanceof MahaSetuError) return e.message;
  return "The request could not be completed. Check your connection and try again.";
}
function go(path: string, msg: string): never {
  redirect(path + "?notice=" + encodeURIComponent(msg));
}

/**
 * "Verify with MahaSetu": ask MahaSetu to start a verification for this application, remember the attempt, and send
 * the applicant's browser to the MahaSetu website. The student ID and mobile number come from the saved application,
 * never from the browser, and the departments and documents come from MahaSetu's registered requirements.
 */
export async function startVerification(id: string) {
  const u = await required();
  if (u.officer) redirect("/officer");
  const back = "/applications/" + encodeURIComponent(id);
  let destination = "";
  try {
    const a = await application(db(), id, u);
    if (!a) throw new UserIssue("Application unavailable.");
    if (FINAL.includes(a.status)) throw new UserIssue("A decision was already recorded, so verification cannot be started.");
    if (!a.mahasetu_student_id || !a.applicant_mobile)
      throw new UserIssue("Save your MahaSetu student ID and mobile number before verifying.");
    const requirements = await mahasetu.requirements();
    const created = await mahasetu.create(id, a.mahasetu_student_id, a.applicant_mobile, requirements, randomUUID());
    let superseded: string[] = [];
    try {
      superseded = await transaction(async (c) => {
        const current = await application(c, id, u, true);
        if (!current) throw new UserIssue("Application unavailable.");
        const old = await c.query(
          "UPDATE verification_transactions SET status='CANCELLED' WHERE application_id=$1 AND status='AWAITING' RETURNING transaction_ref",
          [id],
        );
        await c.query(
          "INSERT INTO verification_transactions(transaction_ref,application_id,mahasetu_student_id,requested_by) VALUES($1,$2,$3,$4)",
          [created.transaction_reference, id, a.mahasetu_student_id, u.id],
        );
        await c.query("UPDATE scholarship_applications SET verification_status='AWAITING_EXTERNAL_VERIFICATION' WHERE id=$1", [id]);
        await c.query(
          "INSERT INTO application_status_history(application_id,status,actor_id,event,note) VALUES($1,$2,$3,$4,$5)",
          [id, current.status, u.id, "Sent to MahaSetu for verification", "Reference " + created.transaction_reference.slice(0, 8).toUpperCase()],
        );
        return old.rows.map((r) => r.transaction_ref as string);
      });
    } catch (error) {
      await mahasetu.cancel(created.transaction_reference).catch(() => undefined); // do not leave an unrecorded request open
      throw error;
    }
    for (const old of superseded) await mahasetu.cancel(old).catch(() => undefined); // best effort: stop abandoned attempts
    destination = launchUrl(created.launch_reference);
  } catch (error) {
    go(back, message(error));
  }
  redirect(destination);
}
