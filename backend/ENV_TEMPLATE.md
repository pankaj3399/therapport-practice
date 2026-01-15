# Environment Variables Template

Create a `.env` file in the backend directory with the following variables:

```
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT Secrets
JWT_SECRET=your-jwt-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production

# Email Configuration (Gmail SMTP)
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM=noreply@therapport.co.uk

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Server Port
PORT=3000

# Admin Password (for seed script)
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin123

# Cloudflare R2 Configuration (for file storage)
# Note: Bucket should be kept PRIVATE - we use presigned URLs for access
# You need to create S3 API credentials (not R2_TOKEN) in Cloudflare Dashboard:
# R2 → Manage API Tokens → Create S3 API Token
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
# R2_PUBLIC_URL is no longer needed - we use presigned URLs instead

# Cron Secret (for scheduled jobs)
CRON_SECRET=your-cron-secret-token-change-in-production
```

## Gmail App Password Setup

To use Gmail SMTP, you need to:
1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the generated app password as `EMAIL_PASSWORD`

## Database Setup

For development, you can use:
- Supabase (https://supabase.com)
- Neon (https://neon.tech)

Copy the connection string to `DATABASE_URL`.

