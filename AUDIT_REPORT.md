# Payroll Hub — Technical Audit Report

## Summary

Full technical audit completed. The following bugs were identified and fixed.

---

## 1. Employee "Not Found" Error

**Problem:** When selecting an employee from the list, the page showed "Employee not found."

**Root cause:** 
- `Promise.all` was used for 4 parallel API calls. If any request failed (e.g. 404, 403, network error), the entire promise rejected and `setEmployee` was never called.
- No error handling for API failures.
- No fallback UI when employee doesn't exist.

**Fixes:**
- **`frontend/src/pages/EmployeeDetail.jsx`**: 
  - Sequential loading: first fetch employee, then fetch related data (payments, compensation, payout history).
  - Added `.catch()` to handle 404/403 and other errors.
  - Added "Back to Employees" button when employee is not found.
  - Set `employee` to `null` on error so the "not found" state is shown correctly.

---

## 2. Create Invoice Not Working

**Problem:** Create Invoice form did not create invoices.

**Root causes:**
- No validation of required fields (employee_id, period_month, period_year, amount).
- Empty strings sent for optional fields caused backend errors (`int('')`, etc.).
- No error display when creation failed.
- Backend lacked validation and clear error messages.

**Fixes:**
- **`backend/app/routes/invoices.py`**:
  - Added validation for employee_id, period_month, period_year, amount.
  - Added checks for employee existence.
  - Proper handling of optional legal_entity_id.
  - Clear error responses (400/404) with messages.

- **`frontend/src/pages/Invoices.jsx`**:
  - Added `createError` state for error messages.
  - Client-side validation before submit.
  - Payload built with correct types (Number for ids and amounts).
  - Error display in the create modal.
  - `try/catch` with user-facing error messages.

---

## 3. Invoice Filters Mismatch

**Problem:** Invoice filters did not match backend API parameters.

**Fixes:**
- **`frontend/src/pages/Invoices.jsx`**:
  - Mapped filters to backend params: `legal_entity` → `legal_entity_id`, `period` → `period_year` + `period_month`.
  - Added employee filter (dropdown).
  - Replaced legal entity text input with select.
  - Added `.catch()` to `fetchInvoices` to avoid unhandled rejections.

---

## 4. Employee Portal — Invoice PDF Download

**Problem:** Invoice PDF download in Employee Portal used `href`, which does not send the auth token.

**Fix:**
- **`frontend/src/pages/EmployeePortal.jsx`**: Replaced `<a href>` with a button that uses `api.get()` (with token) and triggers download via blob URL.

---

## 5. Employee Form — Edit Mode

**Problem:** Possible issues when editing employees (e.g. invalid id, 404).

**Fixes:**
- **`frontend/src/pages/EmployeeForm.jsx`**:
  - Guard for `id === 'new'` to avoid fetching.
  - Redirect to `/employees` on 404 when editing.
  - Added `navigate` to the effect dependency array.

---

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/pages/EmployeeDetail.jsx` | Sequential loading, error handling, "Back to Employees" button |
| `frontend/src/pages/Invoices.jsx` | Validation, error state, correct payload, filter mapping |
| `frontend/src/pages/EmployeePortal.jsx` | PDF download via API instead of href |
| `frontend/src/pages/EmployeeForm.jsx` | 404 handling, id guards |
| `backend/app/routes/invoices.py` | Validation, error responses, employee existence check |

---

## Verification

Backend API tested with:
- Employee list and detail: OK
- Invoice creation: OK (201 with valid payload)
- Auth login: OK

---

## Recommendations

1. **Auth**: Consider longer JWT secret for production (current key triggers HMAC length warning).
2. **Forms**: Add loading states and disable submit during requests where missing.
3. **API**: Add global error handling (e.g. toast/notification) for failed requests.
4. **Tests**: Add integration tests for main flows (employee detail, invoice creation).
