import Link from "next/link";
import {DEMO_STUDENTS, DEPARTMENT_INTERFACES, departmentSites} from "../../lib/demo-guide";
import {settings} from "../../lib/mahasetu";

export const metadata = {title: "Demo guide | MahaSetu", description: "Synthetic data for trying the scholarship service and MahaSetu verification"};

const FIELDS: [string, string][] = [
  ["Student name", "Any name, for example Synthetic Applicant"],
  ["Email", "Any address ending in @example.test or @example.com. Nothing is sent to it."],
  ["Password", "12 to 128 characters"],
  ["District", "Any text, for example Demo District"],
  ["Institution, Programme", "Any text, for example Synthetic College and Demo BSc"],
  ["Academic reference", "Any text, for example DEMO-ACADEMIC"],
  ["Annual household income (INR)", "125000"],
  ["MahaSetu student ID and Mobile number", "A pair from the table below"],
];

export default function DemoGuide() {
  const inbox = `${settings().siteUrl}/messages`;
  const sites = departmentSites();
  return <>
    <p className="eyebrow">For judges and reviewers</p>
    <h1>Demo guide</h1>
    <p className="lead">Everything here is synthetic. Follow the steps with any one of the five demonstration students and see how MahaSetu checks the three government departments for you.</p>

    <section className="panel accent guide-section" aria-labelledby="steps">
      <h2 id="steps">Try it in six steps</h2>
      <ol className="guide-steps">
        <li><b>Create a student account.</b> <Link href="/register">Register</Link> using the values below, then save the profile with a district.</li>
        <li><b>Start an application.</b> Open <Link href="/student">Student desk</Link> and choose <b>Create application</b>. Fill in the details and pick one student from the table, using exactly that student ID and mobile number. Save the draft.</li>
        <li><b>Verify with MahaSetu.</b> The portal does not trust typed-in certificates. It sends you to MahaSetu, which asks three departments for the real records.</li>
        <li><b>Give consent to each department.</b> On each of the Revenue, Examination and University cards choose <b>Verify</b>. A six-digit code appears on the card (in real life it would arrive by SMS). Type it in and choose <b>Confirm</b>.</li>
        <li><b>Finish.</b> MahaSetu fetches the records, converts three different formats into one standard record, applies the approved rules and shows the result with reasons in plain words. Return to the portal to see the same result.</li>
        <li><b>Check the messages.</b> Open the <a href={inbox}>simulated SMS inbox</a>: one-time codes for each department and, unless everything was verified, one result message with the same reasons.</li>
      </ol>
      <p>The first request after a quiet period can take up to a minute while a free hosting plan wakes up, and each hand-over between services can take several seconds. Please wait for the page rather than reloading.</p>
    </section>

    <section className="panel guide-section" aria-labelledby="inputs">
      <h2 id="inputs">What to type</h2>
      <dl>{FIELDS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </section>

    <section className="guide-section" aria-labelledby="students">
      <h2 id="students">The five demonstration students</h2>
      <p className="lead">Enter one student ID with its own mobile number. The outcome depends on the records the departments hold for that ID.</p>
      <div className="student-grid">
        {DEMO_STUDENTS.map(s => <article key={s.id} className={`panel student ${s.tone}`} data-student={s.id}>
          <div className="student-head">
            <h3>{s.id}</h3>
            <span className="status">{s.outcome}</span>
          </div>
          <dl>
            <div><dt>MahaSetu student ID</dt><dd><code>{s.id}</code></dd></div>
            <div><dt>Mobile number</dt><dd><code>{s.mobile}</code></dd></div>
            <div><dt>You should see</dt><dd><b>{s.outcome}</b></dd></div>
            <div><dt>Reasons shown</dt><dd>{s.reasons.length ? <ul className="reasons">{s.reasons.map(r => <li key={r}>{r}</li>)}</ul> : "None: every check passed."}</dd></div>
            <div><dt>Result SMS</dt><dd>{s.resultSms ? "Yes, with the same reasons" : "No"}</dd></div>
          </dl>
          <details>
            <summary>What each department holds for this student</summary>
            <dl>
              <div><dt>Revenue</dt><dd>{s.holds.revenue}</dd></div>
              <div><dt>Examination</dt><dd>{s.holds.examination}</dd></div>
              <div><dt>University</dt><dd>{s.holds.university}</dd></div>
            </dl>
          </details>
        </article>)}
      </div>
    </section>

    <section className="panel guide-section" aria-labelledby="departments">
      <h2 id="departments">The departments MahaSetu contacts</h2>
      <p>Each department keeps its own records in its own system and speaks its own format. MahaSetu converts all three into one standard record. The student never sees any of this.</p>
      <table className="guide-table">
        <thead><tr><th scope="col">Department</th><th scope="col">Holds</th><th scope="col">Format</th><th scope="col">Access</th><th scope="col">Look inside</th></tr></thead>
        <tbody>{DEPARTMENT_INTERFACES.map(d => <tr key={d.key}>
          <th scope="row">{d.name}</th><td>{d.holds}</td><td>{d.format}</td><td>{d.access}</td>
          <td>{sites[d.key] ? <a href={sites[d.key]!} target="_blank" rel="noopener noreferrer">Open the {d.name.replace(" Department", "")} website</a> : "Not published"}</td>
        </tr>)}</tbody>
      </table>
      <p>On a department website, enter any of the five student IDs to see the record that department holds. Compare it with the reasons MahaSetu gave.</p>
    </section>

    <section className="panel guide-section" aria-labelledby="more">
      <h2 id="more">Worth trying</h2>
      <ul>
        <li><b>Consent is per department.</b> Authorize only one department, then choose <b>Finish anyway</b>. The result is &ldquo;Not enough information&rdquo;, and the other two departments are listed as not checked because they were never contacted.</li>
        <li><b>Another student.</b> Register another account, or create another application, and use a different student ID from the table.</li>
        <li><b>A department outage is not your fault.</b> If a department is unavailable, MahaSetu says &ldquo;Could not be completed&rdquo; and records no failure. You can verify again later.</li>
      </ul>
      <p className="notice">All names, numbers, certificates and messages are made up. No real SMS is sent, which is why the one-time codes appear on screen.</p>
    </section>
  </>;
}
