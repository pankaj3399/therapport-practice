---
name: Week 2 Practitioner Dashboard & Compliance
overview: Break down Week 2 deliverables into small, actionable tasks for implementing practitioner dashboard enhancements, document uploads, compliance tracking, role-based feature gating, and email automation for expiry reminders.
todos:
  - id: photo-upload-backend
    content: Create file upload service and photo upload endpoint in backend
    status: pending
  - id: photo-upload-frontend
    content: Enable photo upload functionality in Profile page with preview
    status: pending
    dependencies:
      - photo-upload-backend
  - id: voucher-service
    content: Create voucher service to calculate remaining free booking hours
    status: pending
  - id: dashboard-endpoint
    content: Create practitioner dashboard endpoint returning free hours, credit, bookings
    status: pending
    dependencies:
      - voucher-service
  - id: dashboard-integration
    content: Integrate real data into Dashboard component replacing hardcoded values
    status: pending
    dependencies:
      - dashboard-endpoint
  - id: insurance-upload-backend
    content: Create insurance document upload endpoint with expiry date validation
    status: pending
  - id: insurance-upload-frontend
    content: Enable insurance upload form in Profile page with file and expiry date inputs
    status: pending
    dependencies:
      - insurance-upload-backend
  - id: marketing-addon-check
    content: Create middleware to check marketing add-on access for clinical features
    status: pending
  - id: clinical-upload-backend
    content: Create clinical registration upload endpoint (marketing add-on only)
    status: pending
    dependencies:
      - marketing-addon-check
  - id: clinical-executor-backend
    content: Create clinical executor management endpoints (create/update/get)
    status: pending
    dependencies:
      - marketing-addon-check
  - id: clinical-frontend
    content: Enable clinical documents section conditionally based on marketing add-on
    status: pending
    dependencies:
      - clinical-upload-backend
      - clinical-executor-backend
  - id: reminder-service
    content: Create reminder service to schedule document expiry reminders
    status: pending
  - id: reminder-cron
    content: Create scheduled job to check and send document expiry reminders (API endpoint + node-cron for Linux)
    status: pending
    dependencies:
      - reminder-service
  - id: reminder-templates
    content: Add email templates for insurance and clinical registration expiry reminders
    status: pending
  - id: credit-calculation
    content: Add credit balance calculation service for ad-hoc members
    status: pending
  - id: credit-display
    content: Display real credit balance in Dashboard (current and next month)
    status: pending
    dependencies:
      - credit-calculation
      - dashboard-endpoint
  - id: document-status-widget
    content: Update Documents widget in Dashboard to show real document status
    status: pending
    dependencies:
      - insurance-upload-backend
      - clinical-upload-backend
  - id: practitioner-routes
    content: Create practitioner routes file and register in app.ts
    status: pending
  - id: api-service-updates
    content: Add practitioner API methods in frontend api.ts service
    status: pending
    dependencies:
      - practitioner-routes
  - id: error-handling
    content: Add comprehensive error handling for file uploads and form submissions
    status: pending
  - id: r2-integration
    content: Set up Cloudflare R2 service with S3 SDK for file storage
    status: pending
  - id: admin-membership-endpoints
    content: Create admin endpoints to view and update practitioner memberships (type and marketing add-on)
    status: pending
  - id: admin-routes
    content: Create admin routes file and register in app.ts with admin role protection
    status: pending
    dependencies:
      - admin-membership-endpoints
  - id: admin-panel-ui
    content: Create basic admin panel UI for practitioner management and membership editing
    status: pending
    dependencies:
      - admin-routes
  - id: cron-endpoint
    content: Create API endpoint for reminder processing with hybrid security (accepts x-vercel-signature or x-cron-secret header)
    status: pending
    dependencies:
      - reminder-service
  - id: cron-setup
    content: Configure cron job system (node-cron for Linux with secret header, vercel.json cron config for Vercel)
    status: pending
    dependencies:
      - cron-endpoint
---

# Week 2 – Practitioner Dashboard & Compliance

## Overview

Week 2 focuses on completing the practitioner self-service dashboard with document management, compliance tracking, and automated email reminders. This builds on Week 1's foundation to enable practitioners to manage their own documents and compliance requirements.

## Current State

- ✅ Basic Profile page with contact details and next-of-kin (UI complete)
- ✅ Database schema includes `documents`, `clinicalExecutors`, `freeBookingVouchers` tables
- ✅ Dashboard UI exists with placeholder data
- ❌ Photo upload functionality (UI exists, backend missing)
- ❌ Document upload functionality (UI disabled)
- ❌ Free booking hours display (hardcoded data)
- ❌ Email reminder system for document expiry
- ❌ Role-based feature gating for marketing add-on

## Breakdown of Tasks

### 1. Photo Upload Functionality

**1.1 Backend: File Upload Service with Cloudflare R2 (Presigned URLs)**

- Create `backend/src/services/file.service.ts` for handling file uploads
- Implement Cloudflare R2 integration using `@aws-sdk/client-s3`
- Configure R2 credentials (account ID, access key, secret key, bucket name)
- Implement file validation (image types, size limits) - validate before generating presigned URL
- Generate presigned PUT URLs for direct frontend-to-R2 uploads (no backend memory usage)
- Presigned URLs should expire after reasonable time (e.g., 5 minutes)
- Return presigned URL and final file URL to frontend
- After frontend uploads, backend receives file path and stores in database
- Handle file deletion from R2 when updating/replacing files
- No multer needed - files never touch backend server

**1.2 Backend: Photo Upload Endpoint (Presigned URL)**

- Add `POST /auth/profile/photo/upload-url` endpoint in `backend/src/controllers/auth.controller.ts`
- Accept file metadata (filename, file type, file size)
- Validate file type (images only) and size (e.g., max 5MB)
- Check if user already has a photo (query `users.photoUrl` for current user)
- Generate presigned PUT URL for R2 upload
- Generate unique file path (e.g., `photos/{userId}/{timestamp}-{filename}`)
- Return to frontend:
- Presigned URL for upload
- Final file path in R2
- Old photo path (if exists, for deletion after successful update)
- Add `PUT /auth/profile/photo/confirm` endpoint to confirm upload and update database
- Confirm endpoint flow:

1. Accept new file path from frontend
2. Update `users.photoUrl` in database with new R2 URL
3. If old photo path provided, delete old photo from R2
4. Return updated user data

- Frontend calls confirm endpoint after successful R2 upload with new file path and old photo path (if exists)

**1.3 Frontend: Photo Upload Component (Direct to R2)**

- Enable photo upload button in `frontend/src/pages/Profile.tsx`
- Add file input handler with preview
- When file selected:

1. Call backend to get presigned URL (with file metadata)
2. Upload file directly to R2 using presigned URL (PUT request)
3. Call backend confirm endpoint with file path
4. Update avatar immediately after successful upload

- Show loading state during upload process
- Handle upload errors gracefully
- No file data sent to backend - only metadata and final confirmation

### 2. Dashboard: Free Booking Hours Display

**2.1 Backend: Free Booking Hours Service**

- Create `backend/src/services/voucher.service.ts`
- Add method to calculate remaining free hours for a user
- Consider expiry dates and used hours
- Return active vouchers with remaining hours

**2.2 Backend: Dashboard Data Endpoint**

- Create `GET /practitioner/dashboard` endpoint
- Return free booking hours, credit balance, upcoming bookings
- Include membership type and credit ledger data
- Create `backend/src/controllers/practitioner.controller.ts`

**2.3 Frontend: Dashboard Data Integration**

- Update `frontend/src/pages/Dashboard.tsx` to fetch real data
- Replace hardcoded "4.5 hours" with API data
- Display credit balance from credit ledger
- Show expiry dates for vouchers

### 3. Insurance Document Upload

**3.1 Backend: Document Upload Endpoint**

- Create `POST /practitioner/documents/insurance` endpoint
- Accept file upload and expiry date
- Validate expiry date is in the future
- Store document in `documents` table with `document_type: 'insurance'`
- Link to user via `userId`

**3.2 Backend: Document Validation**

- Add validation middleware for expiry date (must be future date)
- Validate file type (PDF, JPG, JPEG, PNG)
- Validate file size (e.g., max 10MB)

**3.3 Frontend: Insurance Upload Form (Direct to R2)**

- Enable insurance upload section in `frontend/src/pages/Profile.tsx`
- Add file input with drag-and-drop support
- Add expiry date picker with validation
- Upload flow:

1. Get presigned URL from backend (with file metadata and expiry date)
2. Upload file directly to R2 using presigned URL
3. Call backend confirm endpoint with file path and expiry date
4. Update UI with uploaded document status

- Show uploaded document status and expiry
- Display warning if document is expired or expiring soon

**3.4 Backend: Document Retrieval**

- Create `GET /practitioner/documents/insurance` endpoint
- Return current insurance document with expiry date
- Include file URL for download

### 4. Clinical Documents (Marketing Add-On Only)

**4.1 Backend: Role-Based Access Check**

- Create middleware to check if user has marketing add-on
- Add `checkMarketingAddon` middleware in `backend/src/middleware/rbac.middleware.ts`
- Verify `memberships.marketingAddon = true` for user

**4.2 Backend: Clinical Registration Upload**

- Create `POST /practitioner/documents/clinical` endpoint
- Check marketing add-on access before allowing upload
- Store document with `document_type: 'clinical_registration'`
- Validate expiry date

**4.3 Backend: Clinical Executor Management**

- Create `POST /practitioner/clinical-executor` endpoint
- Create or update executor details in `clinicalExecutors` table
- Validate email and phone format
- Only accessible with marketing add-on

**4.4 Frontend: Clinical Section Conditional Rendering**

- Check user's membership type and marketing add-on status
- Hide "Clinical Requirements" tab if no marketing add-on
- Enable clinical registration upload form
- Enable clinical executor form (name, email, phone)
- Show current executor details if exists

**4.5 Backend: Clinical Data Retrieval**

- Create `GET /practitioner/documents/clinical` endpoint
- Create `GET /practitioner/clinical-executor` endpoint
- Return document and executor data

### 5. Email Automation: Document Expiry Reminders

**5.1 Backend: Reminder Scheduling Service**

- Create `backend/src/services/reminder.service.ts`
- Schedule reminders when document is uploaded/updated
- Store reminder schedule in `emailNotifications` table
- Calculate reminder dates (expiry date, 2 weeks after, 4 weeks after)

**5.2 Backend: Reminder Job/Cron (Vercel & Linux Compatible)**

- Create API endpoint `POST /api/admin/cron/process-reminders` with hybrid security approach
- Security implementation (hybrid approach):
  ```typescript
      // Accept requests from:
      // 1. Vercel Cron Jobs (has x-vercel-signature header)
      // 2. External services/Linux (has x-cron-secret header matching CRON_SECRET)
      const vercelSignature = req.headers['x-vercel-signature'];
      const providedSecret = req.headers['x-cron-secret'];
      const expectedSecret = process.env.CRON_SECRET;
      
      const isVercelRequest = !!vercelSignature;
      const hasValidSecret = providedSecret === expectedSecret;
      
      if (!isVercelRequest && !hasValidSecret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  ```




- Create reminder processing function that can be called by cron
- Query `emailNotifications` for pending reminders
- Send emails using existing `email.service.ts`
- Update reminder status after sending
- Handle escalation (practitioner → admin after 2 weeks)
- For Linux servers: 
- Use `node-cron` to schedule the function (e.g., every hour)
- Make HTTP POST request to endpoint with `x-cron-secret` header
- Only start node-cron if `NODE_ENV !== 'production'` or if not on Vercel
- For Vercel: 
- Configure `vercel.json` with cron schedule (see example in Environment Variables section)
- Vercel automatically includes `x-vercel-signature` header
- Add environment variable `CRON_SECRET` for securing the endpoint

**5.3 Backend: Email Templates**

- Add insurance expiry reminder template
- Add clinical registration expiry reminder template
- Add admin escalation template
- Include document type, expiry date, user details

**5.4 Backend: Reminder Endpoints**

- Create `GET /practitioner/reminders` to show upcoming reminders
- Allow manual trigger for testing (admin only)

### 6. Dashboard Enhancements

**6.1 Backend: Credit Balance Calculation**

- Add method to calculate current month's credit balance
- Consider ad-hoc membership monthly credit (£105)
- Calculate used vs remaining credit
- Return next month's credit if applicable

**6.2 Frontend: Credit Display**

- Show current month credit remaining
- Show next month credit (if ad-hoc member)
- Format currency properly (£)
- Show warning if credit is low

**6.3 Frontend: Document Status Widget**

- Update Documents widget in Dashboard
- Show insurance status (valid/expired/expiring soon)
- Show clinical registration status (if marketing add-on)
- Link to Profile page for uploads

### 7. Admin Membership Management

**7.1 Backend: Admin Membership Endpoints**

- Create `backend/src/controllers/admin.controller.ts`
- Add `GET /admin/practitioners` endpoint (list/search practitioners)
- Add `GET /admin/practitioners/:userId` endpoint (get practitioner details with membership)
- Add `PUT /admin/practitioners/:userId/membership` endpoint
- Update membership type (permanent/ad_hoc)
- Toggle marketing add-on on/off
- Validate marketing add-on only for permanent members
- Protect all routes with `requireRole('admin')` middleware

**7.2 Backend: Admin Routes**

- Create `backend/src/routes/admin.routes.ts`
- Register admin routes in `backend/src/app.ts`
- Include membership management routes

**7.3 Frontend: Admin Panel (Basic for Week 2)**

- Create `frontend/src/pages/admin/AdminDashboard.tsx` (basic version)
- Create `frontend/src/pages/admin/PractitionerManagement.tsx`
- Add practitioner list with search functionality
- Add form to edit membership type and toggle marketing add-on
- Protect routes with admin role check
- Add admin navigation item in sidebar (only visible to admins)

### 8. Routes and Integration

**8.1 Backend: Practitioner Routes**

- Create `backend/src/routes/practitioner.routes.ts`
- Add routes for dashboard, documents, executor
- Protect with authentication middleware
- Register routes in `backend/src/app.ts`

**8.2 Frontend: API Service Updates**

- Add practitioner API methods in `frontend/src/services/api.ts`
- Methods for dashboard data, document uploads, executor management
- Add admin API methods for membership management
- Add helper function to upload files directly to R2 using presigned URLs
- Handle presigned URL flow: get URL → upload to R2 → confirm with backend

**8.3 Frontend: Error Handling**

- Add error handling for presigned URL generation
- Add error handling for direct R2 uploads
- Show user-friendly error messages
- Handle network errors gracefully (R2 upload failures, expired presigned URLs)
- Validate forms before submission
- Retry logic for failed R2 uploads if needed

### 9. Testing & Validation

**8.1 Backend: Document Validation Tests**

- Test expiry date validation (past dates rejected)
- Test file type validation
- Test file size limits
- Test marketing add-on access control

**8.2 Frontend: Form Validation**

- Validate file uploads before requesting presigned URL (type, size)
- Validate expiry dates in frontend
- Show validation errors clearly
- Disable submit during upload process
- Validate file before uploading to R2

**8.3 Integration Testing**

- Test complete document upload flow
- Test reminder scheduling
- Test role-based access (with/without marketing add-on)
- Test email sending for reminders

## File Structure

### New Backend Files

- `backend/src/controllers/practitioner.controller.ts`
- `backend/src/controllers/admin.controller.ts`
- `backend/src/services/file.service.ts` (with Cloudflare R2 integration)
- `backend/src/services/voucher.service.ts`
- `backend/src/services/reminder.service.ts`
- `backend/src/routes/practitioner.routes.ts`
- `backend/src/routes/admin.routes.ts`

### Modified Backend Files

- `backend/src/controllers/auth.controller.ts` (add photo upload)
- `backend/src/middleware/rbac.middleware.ts` (add marketing add-on check)
- `backend/src/app.ts` (register practitioner and admin routes, setup node-cron if on Linux)
- `backend/src/services/email.service.ts` (add reminder templates)
- `backend/vercel.json` (add cron configuration for reminder processing - see example below)
- `backend/.env` (add R2 credentials and CRON_SECRET)

### Modified Frontend Files

- `frontend/src/pages/Profile.tsx` (enable uploads, conditional rendering)
- `frontend/src/pages/Dashboard.tsx` (real data integration)
- `frontend/src/services/api.ts` (add practitioner and admin endpoints)
- `frontend/src/components/layout/Sidebar.tsx` (add admin navigation items)
- `frontend/src/App.tsx` (add admin routes)

### New Frontend Files

- `frontend/src/pages/admin/AdminDashboard.tsx` (basic admin dashboard)
- `frontend/src/pages/admin/PractitionerManagement.tsx` (membership management)

## Dependencies

- Cloudflare R2: `@aws-sdk/client-s3` (R2 is S3-compatible) - for generating presigned URLs
- No multer needed - files upload directly from frontend to R2 using presigned URLs
- Cron job solution: 
- `node-cron` for Linux server deployments
- API endpoint for Vercel (can be called by external cron service or Vercel Cron Jobs)

## Environment Variables

### Cloudflare R2 Configuration

- `R2_ACCOUNT_ID` - Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret access key
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_PUBLIC_URL` - Public URL for R2 bucket (e.g., `https://pub-xxxxx.r2.dev`)

### Cron Configuration

- `CRON_SECRET` - Secret token to protect cron endpoint from unauthorized access (required for Linux and external services)
- `NODE_ENV` - Used to determine if cron should use node-cron (production on Linux) or API endpoint (Vercel)

### Vercel Cron Configuration Example

Add to `backend/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/admin/cron/process-reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

This will call the endpoint every hour. Vercel will include `x-vercel-signature` header automatically. The endpoint should accept either `x-vercel-signature` (from Vercel) or `x-cron-secret` header (from external services or Linux node-cron).

## Success Criteria

- ✅ Practitioners can upload and update their profile photo
- ✅ Dashboard shows real free booking hours and credit balance
- ✅ Insurance documents can be uploaded with expiry dates
- ✅ Clinical documents only visible/accessible with marketing add-on
- ✅ Clinical executor details can be saved
- ✅ Email reminders scheduled automatically on document upload
- ✅ Reminders sent at expiry date, 2 weeks after, and 4 weeks after (admin)
- ✅ Role-based access properly enforced