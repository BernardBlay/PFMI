# GitHub Issue: OCR Features Accessible Without Authentication

## Issue Title
🔒 Security: OCR upload and maintenance log ingestion accessible without authentication

## Labels
- `security`
- `bug`
- `enhancement`

## Priority
**High** - Security vulnerability allowing unauthenticated access to sensitive features

---

## Description

### Problem
The OCR maintenance log upload feature (`/ocr-upload`) and its API endpoint (`/api/maintenance-logs`) are currently accessible without requiring user authentication. This creates a security vulnerability where:

1. **Unauthenticated users can access the OCR upload page** from the homepage and footer
2. **Direct API calls can be made** to `/api/maintenance-logs` without authentication
3. **Sensitive maintenance data** could be uploaded or accessed by unauthorized users

### Current Behavior
- Homepage "Ingest Logs (OCR)" button navigates directly to `/ocr-upload`
- Footer "OCR Ingestion" link navigates directly to `/ocr-upload`
- `/ocr-upload` page loads for any user regardless of login status
- API endpoint `/api/maintenance-logs` accepts requests without auth validation

### Expected Behavior
- Unauthenticated users clicking OCR links should be redirected to `/login`
- `/ocr-upload` page should require valid authentication session
- API endpoint should validate authentication and return 401 for unauthenticated requests
- Only logged-in operators should access maintenance log ingestion features

---

## Steps to Reproduce

1. Open application homepage without logging in
2. Click "Ingest Logs (OCR)" button in hero section
3. Observe: Page loads without requiring login ❌
4. Alternatively, navigate to footer and click "OCR Ingestion" link
5. Observe: Page loads without requiring login ❌
6. Direct navigation to `/ocr-upload` also works without auth ❌

---

## Impact

**Security Risk Level:** High

- **Data Integrity:** Unauthenticated users could upload malicious or incorrect maintenance logs
- **System Access:** Bypasses authentication layer for critical infrastructure data
- **Audit Trail:** Cannot track who uploaded specific maintenance records
- **Compliance:** Violates access control requirements for industrial systems

---

## Proposed Solution

### Frontend Protection
1. Create authentication utility library (`lib/auth.ts`)
   - `isAuthenticated()` - Check for valid session
   - `getCurrentUser()` - Get current user data
   - `logout()` - Clear session

2. Protect OCR upload page (`app/ocr-upload/page.tsx`)
   - Add auth check on component mount
   - Redirect to `/login` if not authenticated
   - Show loading state during auth verification

3. Update Hero and Footer components
   - Change OCR links from `<Link>` to `<button>` with onClick handlers
   - Check authentication before navigation
   - Redirect to `/login` if unauthenticated

### Backend Protection
4. Protect API endpoint (`app/api/maintenance-logs/route.ts`)
   - Add authentication validation middleware
   - Verify request origin/referer headers
   - Return 401 Unauthorized for invalid requests

---

## Acceptance Criteria

- [ ] Unauthenticated users cannot access `/ocr-upload` page
- [ ] OCR links redirect to `/login` when user is not authenticated
- [ ] After login, OCR links work normally
- [ ] API endpoint returns 401 for unauthenticated requests
- [ ] Authenticated users can upload maintenance logs successfully
- [ ] No breaking changes to existing authentication flow

---

## Technical Details

**Files to Modify:**
- `apps/web/lib/auth.ts` (create new)
- `apps/web/app/ocr-upload/page.tsx`
- `apps/web/components/Hero.tsx`
- `apps/web/components/Footer.tsx`
- `apps/web/app/api/maintenance-logs/route.ts`

**Authentication Method:**
Current system uses localStorage-based mock authentication with key `pfmi-mock-user`

---

## Related Issues
None

## Environment
- Framework: Next.js 16.2.10
- Authentication: Mock localStorage-based auth
- Affected Routes: `/ocr-upload`, `/api/maintenance-logs`

---

## Instructions to Create This Issue on GitHub

1. Go to: https://github.com/BernardBlay/PFMI/issues/new
2. Copy the title above as issue title
3. Copy the Description section and below as issue body
4. Add labels: `security`, `bug`, `enhancement`
5. Set milestone (if applicable)
6. Submit issue and note the issue number (e.g., #1, #2, etc.)
