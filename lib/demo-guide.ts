/**
 * Synthetic demonstration data shown on /demo-guide. Every value mirrors the fixtures that the three department
 * services seed for the demonstration students; nothing here is real, and nothing here decides an outcome.
 */
export type DemoStudent = {
  id: string;
  mobile: string;
  outcome: "Verified" | "Not verified" | "Incomplete";
  tone: "ok" | "bad" | "warn";
  reasons: string[];
  resultSms: boolean;
  holds: { revenue: string; examination: string; university: string };
};

const VALID_REVENUE = "Income certificate ₹1,50,000 and caste certificate (category DEMO-A), both valid until 31 Dec 2030.";
const SSC_AND_INTERMEDIATE = "SSC (2023) and Intermediate (2025) results, 480 of 600, both passed.";
const ACTIVE_UNIVERSITY = "Registration active (Demo BSc, Science). Bonafide certificate valid until 31 Dec 2030.";

export const DEMO_STUDENTS: DemoStudent[] = [
  {
    id: "MHSTU0001", mobile: "9000000001", outcome: "Verified", tone: "ok", reasons: [], resultSms: false,
    holds: { revenue: VALID_REVENUE, examination: SSC_AND_INTERMEDIATE, university: ACTIVE_UNIVERSITY },
  },
  {
    id: "MHSTU0002", mobile: "9000000002", outcome: "Not verified", tone: "bad", reasons: ["Annual income is above the limit for this scheme."], resultSms: true,
    holds: {
      revenue: "Income certificate ₹3,50,000 and caste certificate (category DEMO-A), both valid until 31 Dec 2030.",
      examination: SSC_AND_INTERMEDIATE, university: ACTIVE_UNIVERSITY,
    },
  },
  {
    id: "MHSTU0003", mobile: "9000000003", outcome: "Not verified", tone: "bad",
    reasons: ["Income certificate has expired.", "Caste certificate has expired."], resultSms: true,
    holds: {
      revenue: "Income certificate ₹1,50,000 and caste certificate (category DEMO-A), both expired on 1 Jan 2026.",
      examination: SSC_AND_INTERMEDIATE, university: ACTIVE_UNIVERSITY,
    },
  },
  {
    id: "MHSTU0004", mobile: "9000000004", outcome: "Incomplete", tone: "warn",
    reasons: ["No SSC result was found at the Examination Department."], resultSms: true,
    holds: { revenue: VALID_REVENUE, examination: "No results on record for this student.", university: ACTIVE_UNIVERSITY },
  },
  {
    id: "MHSTU0005", mobile: "9000000005", outcome: "Incomplete", tone: "warn",
    reasons: ["Enrolment is still pending.", "No bonafide certificate was found at the University."], resultSms: true,
    holds: {
      revenue: VALID_REVENUE, examination: SSC_AND_INTERMEDIATE,
      university: "Registration pending (Demo BSc, Science). No bonafide certificate on file.",
    },
  },
];

/** How each department exposes its records to MahaSetu. Fixed facts of the demonstration, not settings. */
export const DEPARTMENT_INTERFACES = [
  { key: "revenue", name: "Revenue Department", holds: "Income and caste certificates", format: "SOAP 1.2 (XML)", access: "Username and password sent with the request" },
  { key: "examination", name: "Examination Department", holds: "SSC and Intermediate results", format: "Flat JSON over REST", access: "API key in a request header" },
  { key: "university", name: "University", holds: "Registration and bonafide certificate", format: "Nested JSON over REST", access: "Short-lived bearer token, issued per request" },
] as const;

const SITE_SETTINGS = {
  revenue: "DEMO_REVENUE_SITE_URL",
  examination: "DEMO_EXAMINATION_SITE_URL",
  university: "DEMO_UNIVERSITY_SITE_URL",
} as const;

/** Optional addresses of the department websites. Anything that is not a plain http(s) address is ignored. */
export function departmentSites(): Record<keyof typeof SITE_SETTINGS, string | null> {
  const out = {} as Record<keyof typeof SITE_SETTINGS, string | null>;
  for (const [key, name] of Object.entries(SITE_SETTINGS) as [keyof typeof SITE_SETTINGS, string][]) {
    const raw = process.env[name]?.trim();
    try {
      const url = raw ? new URL(raw) : null;
      out[key] = url && (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
        ? url.origin + url.pathname.replace(/\/+$/, "") : null;
    } catch {
      out[key] = null;
    }
  }
  return out;
}
