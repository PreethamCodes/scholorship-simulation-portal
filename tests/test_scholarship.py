"""Run against an isolated seeded scholarship portal and an operator-provisioned officer."""
import os
import secrets
from pathlib import Path

import pytest
from playwright.sync_api import expect, sync_playwright

BASE = os.getenv("SCHOLARSHIP_TEST_URL", "http://127.0.0.1:3000")
SAMPLE = Path(__file__).resolve().parents[1] / "public/sample-document.txt"


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as driver:
        instance = driver.chromium.launch(channel=os.getenv("BROWSER_CHANNEL") or None)
        yield instance
        instance.close()


def login(page, email, password):
    page.goto(BASE + "/login")
    page.get_by_label("Email", exact=True).fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Sign in", exact=True).click()


def register(page):
    email = "student." + secrets.token_hex(6) + "@example.test"
    password = secrets.token_urlsafe(20)
    page.goto(BASE + "/register")
    page.get_by_label("Student name", exact=True).fill("Synthetic Applicant")
    page.get_by_label("Email", exact=True).fill(email)
    page.get_by_label("Password", exact=True).fill(password)
    page.get_by_role("button", name="Register", exact=True).click()
    expect(page.get_by_role("heading", name="My scholarships")).to_be_visible()
    return email, password


def review(page, action, note):
    page.get_by_label("Review action").select_option(action)
    page.get_by_label("Review note").fill(note)
    page.get_by_role("button", name="Record review").click()
    expect(page.locator(".timeline")).to_contain_text(note)


@pytest.mark.parametrize("terminal", ["RECOMMENDED", "REJECTED"])
def test_application_lifecycle(browser, terminal):
    ctx = browser.new_context()
    other = browser.new_context()
    staff = browser.new_context()
    try:
        student = ctx.new_page()
        email, password = register(student)
        student.goto(BASE + "/officer")
        expect(student.get_by_role("heading", name="My scholarships")).to_be_visible()
        student.get_by_label("District", exact=True).fill("Demo District")
        student.get_by_role("button", name="Save profile").click()
        expect(student.get_by_role("status")).to_have_text("Profile saved.")
        student.get_by_role("button", name="Create application").click()
        expect(student.get_by_role("heading", name="Application details")).to_be_visible()
        app_url = student.url.split("?")[0]
        identifier = app_url.rsplit("/", 1)[1]
        student.get_by_label("Institution", exact=True).fill("Synthetic College")
        student.get_by_label("Programme", exact=True).fill("Demo BSc")
        student.get_by_label("Academic reference", exact=True).fill("DEMO-ACADEMIC")
        student.get_by_label("Annual household income (INR)").fill("125000")
        student.get_by_label("MahaSetu student ID").fill("mhstu0001")
        student.get_by_label("Mobile number").fill("9000000001")
        student.get_by_role("button", name="Save draft").click()
        expect(student.locator(".timeline")).to_contain_text("Draft details saved")
        student.get_by_role("button", name="Submit application").click()
        expect(student.get_by_role("status")).to_contain_text("Upload a synthetic supporting document")
        student.get_by_label("Synthetic supporting document").set_input_files(SAMPLE)
        student.get_by_role("button", name="Upload document").click()
        link = student.get_by_role("link", name="sample-document.txt")
        expect(link).to_be_visible()
        doc_url = BASE + link.get_attribute("href")
        assert "SYNTHETIC DEMONSTRATION" in ctx.request.get(doc_url).text()
        stranger = other.new_page()
        assert other.request.get(doc_url).status == 401
        register(stranger)
        assert other.request.get(doc_url).status == 404
        stranger.goto(app_url)
        expect(stranger.get_by_role("heading", name="Application unavailable")).to_be_visible()
        student.get_by_role("button", name="Remove", exact=True).click()
        expect(link).to_have_count(0)
        assert ctx.request.get(doc_url).status == 404
        student.get_by_label("Synthetic supporting document").set_input_files(SAMPLE)
        student.get_by_role("button", name="Upload document").click()
        expect(link).to_be_visible()
        doc_url = BASE + link.get_attribute("href")
        student.get_by_role("button", name="Submit application").click()
        expect(student.locator(".titleline .status")).to_have_text("Submitted")
        officer = staff.new_page()
        login(officer, os.environ["SCHOLARSHIP_TEST_OFFICER_EMAIL"], os.environ["SCHOLARSHIP_TEST_OFFICER_PASSWORD"])
        expect(officer.get_by_role("heading", name="Officer desk")).to_be_visible()
        officer.get_by_label("Search applicants or references").fill(identifier)
        officer.get_by_label("Application status").select_option("SUBMITTED")
        officer.get_by_role("button", name="Filter queue").click()
        officer.locator("a.entry").filter(has_text=identifier).click()
        assert staff.request.get(doc_url).status == 200
        # Modify a genuine form to challenge server-side transition and version checks.
        officer.get_by_label("Review action").evaluate("(el)=>el.append(new Option('Forged','RECOMMENDED'))")
        officer.get_by_label("Review action").select_option("RECOMMENDED")
        officer.get_by_label("Review note").fill("Invalid transition probe")
        officer.get_by_role("button", name="Record review").click()
        expect(officer.get_by_role("status")).to_contain_text("transition is unavailable")
        stale = staff.new_page()
        stale.goto(app_url)
        review(officer, "UNDER_REVIEW", "Review started")
        stale.get_by_label("Review note").fill("Stale note")
        stale.get_by_role("button", name="Record review").click()
        expect(stale.get_by_role("status")).to_contain_text("application changed")
        review(officer, "NOTE", "Academic statement inspected")
        review(officer, "ADDITIONAL_INFORMATION_REQUIRED", "Clarify the synthetic programme")
        student.reload()
        student.get_by_label("Programme", exact=True).fill("Demo BSc Mathematics")
        student.get_by_role("button", name="Resubmit application").click()
        expect(student.locator(".titleline .status")).to_have_text("Resubmitted")
        officer.reload()
        review(officer, "UNDER_REVIEW", "Resubmission checked")
        review(officer, terminal, "Decision recorded for demonstration")
        expect(officer.locator(".titleline .status")).to_have_text(terminal.capitalize())
        student.get_by_role("button", name="Sign out").click()
        assert ctx.request.get(doc_url).status == 401
        login(student, email, password)
        expect(student.get_by_role("heading", name="My scholarships")).to_be_visible()  # wait for the sign-in to finish
        student.goto(app_url)
        expect(student.locator(".titleline .status")).to_have_text(terminal.capitalize())
        expect(student.locator(".timeline")).to_contain_text("Clarify the synthetic programme")
        expect(student.get_by_role("heading", name="Verify with MahaSetu")).to_be_visible()
    finally:
        ctx.close()
        other.close()
        staff.close()
