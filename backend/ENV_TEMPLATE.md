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

