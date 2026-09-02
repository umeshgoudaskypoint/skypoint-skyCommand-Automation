# Feature: Authentication

## TC-AUTH-001: Unauthenticated user is redirected to the Skypoint login page
- Priority: High
- Section: Login
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: No active session
- Steps:
  1. Navigate to the application root
  2. Wait for the redirect to complete
  3. Verify the URL is on login.skypointcloud.com
  4. Verify the sign-in options are displayed
- Expected: User is redirected to the Skypoint B2C login page

## TC-AUTH-002: All sign-in provider options are displayed
- Priority: High
- Section: Login
- Type: ui
- Status: Automated
- Tags: sanity, regression
- Precondition: User is on the login page
- Steps:
  1. Navigate to the login page
  2. Verify "Sign In with Microsoft" is displayed
  3. Verify "Sign In with Google" is displayed
  4. Verify "Sign in with Apple" is displayed
  5. Verify "Sign in with Email & Password" is displayed
- Expected: All configured identity providers are offered

## TC-AUTH-003: Email and password form opens from the provider chooser
- Priority: Medium
- Section: Login
- Type: ui
- Status: Automated
- Tags: regression
- Precondition: User is on the login page
- Steps:
  1. Navigate to the login page
  2. Click "Sign in with Email & Password"
  3. Verify the email field is displayed
  4. Verify the password field is displayed
  5. Verify the Sign in button is displayed
- Expected: The local account form is revealed with email, password and submit

## TC-AUTH-004: Invalid credentials show an error message
- Priority: High
- Section: Login
- Type: ui
- Status: Automated
- Tags: regression, negative
- Precondition: No active session
- Steps:
  1. Navigate to the login page
  2. Open the email and password form
  3. Enter an invalid email address
  4. Enter an invalid password
  5. Click Sign in
  6. Verify an error message is displayed
- Expected: B2C rejects the sign-in and the user remains on the login page

## TC-AUTH-005: Valid credentials sign the user in
- Priority: High
- Section: Login
- Type: ui
- Status: Not Automated
- Tags: sanity, regression
- Precondition: A valid QA account exists
- Steps:
  1. Navigate to the login page
  2. Open the email and password form
  3. Enter the QA account email
  4. Enter the QA account password
  5. Click Sign in
  6. Verify redirect back into the application
- Expected: User lands in the application, authenticated

## TC-AUTH-006: Session persists across a page reload
- Priority: Medium
- Section: Session
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is logged in
- Steps:
  1. Log in to the application
  2. Reload the page
  3. Verify the user is still authenticated
- Expected: User is not sent back to the login page

## TC-AUTH-007: Forgot password link is available
- Priority: Low
- Section: Login
- Type: ui
- Status: Not Automated
- Tags: regression
- Precondition: User is on the email and password form
- Steps:
  1. Navigate to the login page
  2. Open the email and password form
  3. Verify the "Forgot your password?" link is displayed
- Expected: Password recovery is reachable from the sign-in form
