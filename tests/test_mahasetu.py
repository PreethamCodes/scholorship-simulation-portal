"""Verify-with-MahaSetu integration, driven through two real websites: this portal and the MahaSetu website.

Needs the whole local stack: this portal, MahaSetu Core with the three departments, and the MahaSetu website, with
Core running with OTP_DEMO_DISCLOSURE=enabled. Use localhost (not 127.0.0.1) for the portal URL, because MahaSetu
returns the applicant to the return address registered in Core (http://localhost:3000/verification/return).

  SCHOLARSHIP_TEST_URL (default http://localhost:3000)  MAHASETU_SITE_URL (default http://localhost:3004)
  CORE_URL (default http://localhost:8000)  CORE_REQUESTER_TOKEN (to read results the way an operator could)
"""
import os
import re
import secrets

import httpx
import pytest
from playwright.sync_api import expect, sync_playwright

PORTAL = os.getenv("SCHOLARSHIP_TEST_URL", "http://localhost:3000").rstrip("/")
SITE = os.getenv("MAHASETU_SITE_URL", "http://localhost:3004").rstrip("/")
CORE = os.getenv("CORE_URL", "http://localhost:8000").rstrip("/")
TOKEN = os.getenv("CORE_REQUESTER_TOKEN", "")
PROVIDERS = ("revenue", "examination", "university")

pytestmark = pytest.mark.skipif(not TOKEN, reason="CORE_REQUESTER_TOKEN is not set")


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as driver:
        instance = driver.chromium.launch(channel=os.getenv("BROWSER_CHANNEL") or None)
        yield instance
        instance.close()


@pytest.fixture()
def page(browser):
    context = browser.new_context()
    page = context.new_page()
    page.set_default_timeout(20000)
    yield page
    context.close()


def register(page):
    email = "student." + secrets.token_hex(6) + "@example.test"
    page.goto(PORTAL + "/register")
    page.get_by_label("Student name", exact=True).fill("Synthetic Applicant")
    page.get_by_label("Email", exact=True).fill(email)
    page.get_by_label("Password", exact=True).fill(secrets.token_urlsafe(20))
    page.get_by_role("button", name="Register", exact=True).click()
    expect(page.get_by_role("heading", name="My scholarships")).to_be_visible()
    page.get_by_label("District", exact=True).fill("Demo District")
    page.get_by_role("button", name="Save profile").click()
    expect(page.get_by_role("status")).to_have_text("Profile saved.")


def application(page, student="MHSTU0001", mobile="9000000001"):
    """Create and save a draft application. Returns its URL."""
    page.goto(PORTAL + "/student")
    page.get_by_role("button", name="Create application").click()
    expect(page.get_by_role("heading", name="Application details")).to_be_visible()
    url = page.url.split("?")[0]
    page.get_by_label("Institution", exact=True).fill("Synthetic College")
    page.get_by_label("Programme", exact=True).fill("Demo BSc")
    page.get_by_label("Academic reference", exact=True).fill("DEMO-ACADEMIC")
    page.get_by_label("Annual household income (INR)").fill("125000")
    page.get_by_label("MahaSetu student ID").fill(student)
    page.get_by_label("Mobile number").fill(mobile)
    page.get_by_role("button", name="Save draft").click()
    expect(page.locator(".timeline")).to_contain_text("Draft details saved")
    return url


def verify_on_mahasetu(page, providers=PROVIDERS):
    for provider in providers:
        article = page.locator(f"article[data-provider={provider}]")
        article.get_by_role("button", name="Verify", exact=True).click()
        code = article.locator(".demo-code strong")
        expect(code).to_be_visible()
        article.get_by_label("Six-digit code").fill(code.inner_text())
        article.get_by_role("button", name="Confirm").click()
        expect(article).to_have_attribute("data-status", "COMPLETED")


def start(page, button="Verify with MahaSetu"):
    page.get_by_role("button", name=button, exact=True).click()
    expect(page).to_have_url(re.compile("^" + re.escape(SITE) + "/verify"))


def transaction_of(page):
    """The MahaSetu transaction the applicant is currently in, read from the website's server-rendered state."""
    return page.evaluate("fetch('/api/core/overview').then(r=>r.json()).then(o=>o.transaction_reference)")


def core_state(transaction):
    response = httpx.get(f"{CORE}/v1/verification-requests/{transaction}", headers={"Authorization": f"Bearer {TOKEN}"}, timeout=20)
    response.raise_for_status()
    return response.json()["state"]


def test_the_panel_explains_what_is_needed_before_verifying(page):
    register(page)
    application(page, student="MHSTU0001")
    panel = page.locator("#verification")
    expect(panel.get_by_role("heading", name="Verify with MahaSetu")).to_be_visible()
    expect(panel).to_contain_text("Not requested")
    expect(panel.get_by_role("button", name="Verify with MahaSetu", exact=True)).to_be_visible()


def test_verify_needs_a_saved_student_id_and_mobile(page):
    register(page)
    page.goto(PORTAL + "/student")
    page.get_by_role("button", name="Create application").click()
    expect(page.get_by_role("heading", name="Application details")).to_be_visible()
    expect(page.locator("#verification")).to_contain_text("Save your MahaSetu student ID and mobile number")
    expect(page.get_by_role("button", name="Verify with MahaSetu", exact=True)).to_have_count(0)


@pytest.mark.parametrize("student,state,status,reasons", [
    ("MHSTU0001", "VERIFIED", "Verified", []),
    ("MHSTU0002", "FAILED_CHECK", "Not verified", ["Annual income is above the limit for this scheme."]),
    ("MHSTU0003", "FAILED_CHECK", "Not verified", ["Income certificate has expired.", "Caste certificate has expired."]),
    ("MHSTU0004", "INSUFFICIENT_DATA", "Incomplete", ["No SSC result was found at the Examination Department."]),
    ("MHSTU0005", "PARTIAL", "Incomplete", ["Enrolment is still pending.", "No bonafide certificate was found at the University."]),
])
def test_full_round_trip(page, student, state, status, reasons):
    register(page)
    url = application(page, student=student, mobile="900000000" + student[-1])
    start(page)
    assert "ref=" not in page.url
    verify_on_mahasetu(page)
    page.get_by_role("button", name=re.compile("^Finish")).click()
    expect(page.locator("h1")).to_have_attribute("data-state", state)
    page.get_by_role("link", name=re.compile("^Return to")).click()
    expect(page).to_have_url(re.compile("^" + re.escape(url)))
    expect(page.get_by_role("status")).to_contain_text("MahaSetu verification")
    panel = page.locator("#verification")
    expect(panel.locator(".result")).to_have_attribute("data-state", state)
    expect(panel.locator(".status").first).to_have_text(status)
    for reason in reasons:
        expect(panel.get_by_text(reason)).to_be_visible()
    expect(panel).to_contain_text(f"student ID {student}")
    expect(page.locator(".timeline")).to_contain_text("Sent to MahaSetu for verification")
    expect(page.locator(".timeline")).to_contain_text("MahaSetu verification:")
    page.reload()  # the recorded result survives a reload and a repeat visit to the return address does nothing
    expect(page.locator("#verification .result")).to_have_attribute("data-state", state)
    expect(page.get_by_role("button", name="Verify again with MahaSetu", exact=True)).to_be_visible()


def test_returning_without_finishing_keeps_waiting_and_starting_again_cancels_the_old_attempt(page):
    register(page)
    url = application(page)
    start(page)
    first = transaction_of(page)
    page.goto(url)  # the applicant leaves MahaSetu without finishing
    expect(page.locator("#verification")).to_contain_text("Awaiting external verification")
    expect(page.locator("#verification")).to_contain_text("start again below")
    page.goto(f"{PORTAL}/verification/return?ref={first}")
    expect(page.get_by_role("status")).to_contain_text("not finished at MahaSetu")
    expect(page.locator("#verification")).to_contain_text("Awaiting external verification")
    start(page, "Start again with MahaSetu")
    assert transaction_of(page) != first
    assert core_state(first) == "CANCELLED"


def test_a_return_link_cannot_be_forged_or_borrowed(page, browser):
    register(page)
    url = application(page)
    start(page)
    verify_on_mahasetu(page)
    transaction = transaction_of(page)
    page.get_by_role("button", name=re.compile("^Finish")).click()
    expect(page.locator("h1")).to_have_attribute("data-state", "VERIFIED")
    # Another signed-in applicant cannot use the transaction reference to see or record this result.
    other = browser.new_context()
    stranger = other.new_page()
    stranger.set_default_timeout(20000)
    try:
        register(stranger)
        stranger.goto(f"{PORTAL}/verification/return?ref={transaction}")
        expect(stranger.get_by_role("status")).to_contain_text("could not be found")
        # Nobody signed in: sent to sign in, nothing recorded.
        anonymous = browser.new_context()
        visitor = anonymous.new_page()
        visitor.goto(f"{PORTAL}/verification/return?ref={transaction}")
        expect(visitor).to_have_url(re.compile("/login"))
        anonymous.close()
    finally:
        other.close()
    page.goto(f"{PORTAL}/verification/return?ref=not-a-uuid")
    expect(page.get_by_role("status")).to_contain_text("not valid")
    page.goto(f"{PORTAL}/verification/return?ref=00000000-0000-4000-8000-000000000000")
    expect(page.get_by_role("status")).to_contain_text("could not be found")
    # The genuine return still records the outcome read from MahaSetu.
    page.goto(f"{PORTAL}/verification/return?ref={transaction}")
    expect(page).to_have_url(re.compile("^" + re.escape(url)))
    expect(page.locator("#verification .result")).to_have_attribute("data-state", "VERIFIED")


def test_another_applicant_cannot_start_or_see_an_application_verification(page, browser):
    register(page)
    url = application(page)
    other = browser.new_context()
    stranger = other.new_page()
    stranger.set_default_timeout(20000)
    try:
        register(stranger)
        stranger.goto(url)
        expect(stranger.get_by_role("heading", name="Application unavailable")).to_be_visible()
    finally:
        other.close()


def test_a_service_credential_is_never_sent_to_the_browser(page):
    register(page)
    url = application(page)
    page.goto(url)
    html = page.content()
    assert TOKEN not in html and "MAHASETU_REQUESTER_TOKEN" not in html
    start(page)
    assert TOKEN not in page.content()
