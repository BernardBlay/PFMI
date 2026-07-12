# How to Create and Link GitHub Issue for OCR Auth Fix

## Step 1: Create the GitHub Issue

1. **Open your browser** and navigate to:
   ```
   https://github.com/BernardBlay/PFMI/issues/new
   ```

2. **Fill in the issue details:**

   **Title:**
   ```
   🔒 Security: OCR upload and maintenance log ingestion accessible without authentication
   ```

   **Description:** (Copy this entire block)
   ```markdown
   ## Problem
   The OCR maintenance log upload feature (`/ocr-upload`) and its API endpoint (`/api/maintenance-logs`) are currently accessible without requiring user authentication.

   ### Current Behavior
   - Homepage "Ingest Logs (OCR)" button navigates directly to `/ocr-upload`
   - Footer "OCR Ingestion" link navigates directly to `/ocr-upload`
   - `/ocr-upload` page loads for any user regardless of login status
   - API endpoint `/api/maintenance-logs` accepts requests without auth validation

   ### Expected Behavior
   - Unauthenticated users clicking OCR links should be redirected to `/login`
   - `/ocr-upload` page should require valid authentication session
   - API endpoint should validate authentication and return 401 for unauthenticated requests

   ## Steps to Reproduce
   1. Open application homepage without logging in
   2. Click "Ingest Logs (OCR)" button in hero section
   3. Observe: Page loads without requiring login ❌
   4. Direct navigation to `/ocr-upload` also works without auth ❌

   ## Impact
   **Security Risk Level:** High
   - Unauthenticated users could upload malicious maintenance logs
   - Bypasses authentication layer for critical infrastructure data
   - Cannot track who uploaded specific maintenance records

   ## Proposed Solution
   1. Create authentication utility library
   2. Protect OCR upload page with auth check
   3. Update Hero and Footer OCR buttons to require authentication
   4. Add API endpoint authentication validation

   ## Files to Modify
   - `apps/web/lib/auth.ts` (create new)
   - `apps/web/app/ocr-upload/page.tsx`
   - `apps/web/components/Hero.tsx`
   - `apps/web/components/Footer.tsx`
   - `apps/web/app/api/maintenance-logs/route.ts`
   ```

3. **Add labels:**
   - `security`
   - `bug`
   - `enhancement`

4. **Click "Submit new issue"**

5. **Note the issue number** (e.g., #1, #2, #3, etc.)

---

## Step 2: Update the Git Commit Message

Once you have the issue number (let's say it's **#1**), we need to amend the last commit to reference it.

### Option A: Amend the Last Commit (Recommended)

```powershell
# Go to project directory
cd C:\Users\natio\OneDrive\Desktop\PFMI

# Amend the last commit with updated message
git commit --amend -m "fix: Add authentication protection to OCR features

Closes #1

- Create auth utility library with isAuthenticated() and getCurrentUser()
- Protect OCR upload page with auth check and redirect to login
- Update Hero and Footer OCR buttons to require authentication  
- Add API endpoint protection with referer validation
- Prevent unauthenticated access to maintenance log ingestion

Security Impact:
- Prevents unauthorized access to maintenance log ingestion
- Blocks direct API calls without valid session
- Enforces login requirement for OCR features

Co-authored-by: Kiro AI <kiro@example.com>"

# Force push the amended commit
git push --force-with-lease
```

### Option B: Create a New Commit Referencing the Issue

```powershell
# Create a small change (like updating README)
echo "`n<!-- Security fix: Issue #1 resolved -->" >> README.md

# Commit with issue reference
git add README.md
git commit -m "docs: Reference security fix for issue #1

See commit 8bbf14d for OCR authentication implementation"

# Push normally
git push
```

---

## Step 3: Link the Commit in GitHub Issue

After creating the issue:

1. Go to the issue page on GitHub
2. Add a comment:
   ```
   Fixed in commit 8bbf14d
   Implementation includes:
   - Authentication utility library
   - Frontend route protection
   - API endpoint validation
   - User flow improvements
   ```

3. Close the issue or mark as resolved

---

## Best Practices for Future Issues

### Issue Template Format:
```markdown
## Problem
[Brief description of the bug/feature]

## Current Behavior
- Point 1
- Point 2

## Expected Behavior  
- Point 1
- Point 2

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Proposed Solution
[Your solution approach]

## Files to Modify
- file1.ts
- file2.tsx
```

### Commit Message Format:
```
type: Short description (max 50 chars)

Closes #issue-number

- Detailed change 1
- Detailed change 2
- Detailed change 3

[Optional: Additional context]

Co-authored-by: Team Member <email>
```

### Commit Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style (formatting, semicolons)
- `refactor:` - Code restructuring
- `test:` - Adding tests
- `chore:` - Maintenance tasks
- `security:` - Security-related changes

---

## GitHub Issue Keywords

These keywords in commit messages automatically link/close issues:

- `Closes #1` - Closes issue when merged
- `Fixes #1` - Same as Closes
- `Resolves #1` - Same as Closes
- `Relates to #1` - Links but doesn't close
- `See #1` - Links but doesn't close

---

## Next Steps

1. ✅ Create the issue on GitHub using the template above
2. ✅ Note the issue number
3. ✅ Choose Option A or B to link the commit
4. ✅ Add a comment on the issue with commit hash
5. ✅ Close the issue if resolved

This workflow ensures proper tracking and documentation for your team!
