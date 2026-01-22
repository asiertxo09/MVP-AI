from playwright.sync_api import sync_playwright
import time

def verify_auth_ui():
    """
    Verifies that the Login UI correctly handles the 'Pending Approval' state.
    Since we cannot start the real backend easily, we mock the API response 
    to simulate what the new backend logic would return (403 Forbidden).
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Mock /api/login to return 403 Pending Approval
        def handle_login(route):
            print("Mocking /api/login response: 403 Forbidden")
            route.fulfill(
                status=403,
                content_type="application/json",
                body='{"error": "Cuenta pendiente de aprobación"}'
            )

        page.route("**/api/login", handle_login)

        # Mock /login.html to serve the actual file from disk if needed, 
        # but usually we rely on a running server. 
        # Attempting to open file directly for simplicity if no server running.
        # But relative paths in HTML might break. 
        # Ideally, user should serve the 'frontend' dir. 
        # Let's assume we can map local files or use a simple file server approach OR 
        # assume the user has a dev server running on localhost:8000 as implied by verify_frontend.py.
        
        target_url = "http://localhost:8000/login.html" 
        
        print(f"Navigating to {target_url}...")
        try:
            page.goto(target_url)
        except Exception as e:
            print(f"Could not connect to {target_url}. Ensure server is running.")
            # Fallback: Just print what we would do
            print("SKIPPING UI TEST: Server not reachable.")
            browser.close()
            return

        # Fill login form
        print("Filling login form...")
        try:
            page.fill("#login-username", "parent@test.com")
            page.fill("#login-password", "password123")
            
            # Click submit
            page.click("button[type='submit']")
            
            # Wait for error message
            # The auth.js puts error in [data-error-for="login-password"] or a status element
            # Let's check for the text "Cuenta pendiente de aprobación" anywhere
            print("Waiting for error message...")
            page.wait_for_selector("text=Cuenta pendiente de aprobación", timeout=3000)
            
            print("✅ SUCCES: UI correctly showed 'Cuenta pendiente de aprobación'")
            
        except Exception as e:
            print(f"❌ FAILURE: UI did not show expected error. {e}")
            page.screenshot(path="auth_verify_fail.png")

        browser.close()

if __name__ == "__main__":
    verify_auth_ui()
