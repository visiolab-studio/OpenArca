# Test Matrix

## Backend Priority Tests
- OTP request/verify success and failure conditions
- Domain allowlist enforcement
- Role-based ticket visibility (`user` vs `developer`)
- History rows for every tracked field change
- Notification trigger and suppression logic

## Frontend Priority Tests
- Login OTP flow with expiration handling
- New ticket conditional validation by category
- Protected routes by role
- Board and TODO visible only for developer

## E2E Smoke Path
1. User requests OTP and logs in.
2. User creates bug ticket with required details.
3. Developer logs in and moves ticket status.
4. User sees updated status and developer comment.
