from playwright.sync_api import sync_playwright
import time

def verify_specialist_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context with mocked session in localStorage
        context = browser.new_context()

        # Add init script to set localStorage before page loads
        context.add_init_script("""
            localStorage.setItem('eduplay_session', 'active');
        """)

        page = context.new_page()

        # Mock API responses

        # 1. Mock /api/children (Patients list)
        page.route("**/api/children", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"children": [{"id": 1, "username": "paciente_juan", "last_activity_date": "2023-10-27T10:00:00Z", "energy_level": 7.5}]}'
        ))

        # 2. Mock /api/metrics (Stats)
        page.route("**/api/metrics?type=current**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"current": {"total_stars": 50, "energy_level": 8.0, "current_streak": 5, "total_activities_completed": 20, "total_time_played_seconds": 3600}}'
        ))

        page.route("**/api/metrics?type=daily**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"daily": [{"date": "2023-10-27", "total_stars": 10, "activities_by_type": "{\\"math\\": 5, \\"read\\": 2}"}]}'
        ))

        page.route("**/api/metrics?type=activities**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"activities": [{"activity_type": "math", "activity_name": "Suma", "completed_at": "2023-10-27T10:00:00Z", "stars_earned": 3, "is_correct": true}]}'
        ))

        page.route("**/api/assessment**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"assessments": [{"completed": 1}]}'
        ))

        # Mock Session Cookie via header or logic if needed, but localStorage might suffice for client-side check.
        # However, api-client might fail if it doesn't see session.
        # But we are mocking all API calls, so it doesn't matter what api-client sends, we intercept it.

        page_url = "http://localhost:8000/portal-specialist.html"

        print(f"Navigating to {page_url}")
        page.goto(page_url)

        # Wait for content to load
        try:
            page.wait_for_selector(".patient-card", timeout=5000)
            print("Patient card found.")

            # Click on the patient to open stats
            print("Clicking patient card...")
            page.click(".patient-card")

            # Wait for stats modal
            page.wait_for_selector("#statsSection", state="visible")
            print("Stats section visible.")

            # Take screenshot
            screenshot_path = "/home/jules/verification/specialist_dashboard.png"
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_state.png")

        browser.close()

if __name__ == "__main__":
    verify_specialist_dashboard()
