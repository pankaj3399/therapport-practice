# Environment Variables Template

## Development

Create a `.env` file in the frontend directory:

```
VITE_API_URL=http://localhost:3000/api
VITE_STRIPE_PUBLISHABLE_KEY
```

The Vite proxy in `vite.config.ts` will handle `/api` requests in development.

## Production (Vercel)

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add a new variable:
   - **Name**: `VITE_API_URL`
   - **Value**: Your deployed backend URL (e.g., `https://your-backend.vercel.app/api`)
   - **Environment**: Production, Preview, Development (as needed)

**Important**:

- The Vite proxy in `vite.config.ts` only works in development (`npm run dev`)
- In production on Vercel, the frontend makes direct API calls using `VITE_API_URL`
- Make sure your backend CORS settings allow requests from your frontend domain
