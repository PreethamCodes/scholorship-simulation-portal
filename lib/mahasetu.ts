import "server-only";
import { z } from "zod";

/** Server-side client for MahaSetu Core. The credential never leaves the server. */
export class MahaSetuError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function settings() {
  return {
    coreUrl: (process.env.MAHASETU_CORE_URL ?? "http://localhost:8000").replace(/\/+$/, ""),
    siteUrl: (process.env.MAHASETU_SITE_URL ?? "http://localhost:3004").replace(/\/+$/, ""),
    token: process.env.MAHASETU_REQUESTER_TOKEN ?? "",
    serviceId: process.env.MAHASETU_SERVICE_ID ?? "DEMO-PMS",
  };
}

const Requirements = z.object({
  purpose: z.string(),
  requirements: z.array(z.object({ provider_id: z.string(), evidence_categories: z.array(z.string()).min(1) })).min(1),
});
const Created = z.object({
  transaction_reference: z.uuid(),
  launch_reference: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
});
export const CORE_STATES = ["VERIFIED", "FAILED_CHECK", "PARTIAL", "MANUAL_REVIEW", "INSUFFICIENT_DATA", "RULES_NOT_CONFIGURED", "ACCESS_DENIED", "PROVIDER_ERROR", "CANCELLED"] as const;
const Report = z.object({
  transaction_reference: z.uuid(),
  state: z.enum(CORE_STATES),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  needs_review: z.number().int().min(0),
  completed_at: z.string(),
  checks: z.array(z.object({
    provider_id: z.string(),
    outcome: z.enum(["PASS", "FAIL", "NEEDS_REVIEW"]),
    message: z.string().min(1).max(240),
  })),
});
export type Report = z.infer<typeof Report>;
const Ack = z.object({ transaction_reference: z.uuid(), state: z.string() });

async function call<T>(path: string, schema: z.ZodType<T>, init: { method?: "GET" | "POST"; body?: unknown; key?: string } = {}): Promise<T> {
  const { coreUrl, token } = settings();
  if (!token) throw new MahaSetuError(503, "NOT_CONFIGURED", "Verification with MahaSetu is not set up on this portal.");
  let response: Response;
  try {
    response = await fetch(coreUrl + path, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.key ? { "Idempotency-Key": init.key } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new MahaSetuError(503, "UNREACHABLE", "MahaSetu could not be reached. Please try again in a moment.");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = z.object({ code: z.string(), message: z.string() }).safeParse(payload);
    throw new MahaSetuError(response.status, error.success ? error.data.code : "BAD_RESPONSE",
      error.success ? error.data.message : "MahaSetu sent an unexpected answer.");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new MahaSetuError(502, "BAD_RESPONSE", "MahaSetu sent an unexpected answer.");
  return parsed.data;
}

export const mahasetu = {
  /** What this service may ask MahaSetu for, so the portal never hard-codes departments or documents. */
  requirements: () => call(`/v1/services/${encodeURIComponent(settings().serviceId)}/requirements`, Requirements),
  create: (applicationReference: string, studentId: string, mobile: string, req: z.infer<typeof Requirements>, key: string) =>
    call("/v1/verification-requests", Created, {
      method: "POST",
      key,
      body: {
        service_id: settings().serviceId,
        application_reference: applicationReference,
        applicant_reference: studentId,
        applicant_mobile: mobile,
        purpose: req.purpose,
        requested_evidence: req.requirements.map((r) => ({ provider_id: r.provider_id, evidence_categories: r.evidence_categories })),
      },
    }),
  /** Authoritative outcome. The return address only says which transaction to ask about. */
  results: (transaction: string) => call(`/v1/verification-requests/${transaction}/results`, Report),
  cancel: (transaction: string) => call(`/v1/verification-requests/${transaction}/cancel`, Ack, { method: "POST" }),
};

export const launchUrl = (launchReference: string) => `${settings().siteUrl}/start?ref=${encodeURIComponent(launchReference)}`;
