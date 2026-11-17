"""The public demo guide: needs the portal running, but no sign-in, no database content and no other service.

  SCHOLARSHIP_TEST_URL (default http://127.0.0.1:3000)   BROWSER_CHANNEL (e.g. msedge) to use an installed browser
"""
import os
import re

import pytest
from playwright.sync_api import expect, sync_playwright

BASE = os.getenv("SCHOLARSHIP_TEST_URL", "http://127.0.0.1:3000").rstrip("/")

# student -> (mobile, outcome, reasons the guide must list)
STUDENTS = {
    "MHSTU0001": ("9000000001", "Verified", []),
    "MHSTU0002": ("9000000002", "Not verified", ["Annual income is above the limit for this scheme."]),
    "MHSTU0003": ("9000000003", "Not verified", ["Income certificate has expired.", "Caste certificate has expired."]),
    "MHSTU0004": ("9000000004", "Incomplete", ["No SSC result was found at the Examination Department."]),
    "MHSTU0005": ("9000000005", "Incomplete", ["Enrolment is still pending.", "No bonafide certificate was found at the University."]),
}


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
    page.set_default_timeout(25000)
    yield page
    context.close()


def test_guide_is_public_and_reachable_from_the_navigation_and_home_page(page):
    page.goto(BASE + "/")
    page.get_by_role("link", name="Demo guide", exact=True).click()
    expect(page).to_have_url(BASE + "/demo-guide")
    expect(page.get_by_role("heading", name="Demo guide", level=1)).to_be_visible()
    page.goto(BASE + "/")
    page.get_by_role("link", name="Demo guide →").click()
    expect(page).to_have_url(BASE + "/demo-guide")


def test_guide_lists_every_demonstration_student_with_outcome_and_reasons(page):
    page.goto(BASE + "/demo-guide")
    cards = page.locator("article[data-student]")
    expect(cards).to_have_count(len(STUDENTS))
    for student, (mobile, outcome, reasons) in STUDENTS.items():
        card = page.locator(f'article[data-student="{student}"]')
        expect(card.get_by_text(student, exact=True).first).to_be_visible()
        expect(card.locator("code", has_text=mobile)).to_be_visible()
        expect(card.locator(".status")).to_have_text(outcome)
        for reason in reasons:
            expect(card.get_by_text(reason)).to_be_visible()
        card.locator("summary").click()
        for department in ("Revenue", "Examination", "University"):
            expect(card.locator("dt", has_text=department)).to_be_visible()


def test_guide_explains_the_three_departments_and_links_the_inbox(page):
    page.goto(BASE + "/demo-guide")
    table = page.locator("table.guide-table")
    for text in ("SOAP 1.2 (XML)", "Flat JSON over REST", "Nested JSON over REST"):
        expect(table.get_by_text(text)).to_be_visible()
    expect(table.locator("tbody tr")).to_have_count(3)
    inbox = page.get_by_role("link", name="simulated SMS inbox")
    expect(inbox).to_have_attribute("href", re.compile(r"/messages$"))


def test_guide_fits_a_phone_without_sideways_scrolling(browser):
    context = browser.new_context(viewport={"width": 375, "height": 800})
    page = context.new_page()
    page.goto(BASE + "/demo-guide")
    expect(page.get_by_role("heading", name="Demo guide", level=1)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    context.close()
