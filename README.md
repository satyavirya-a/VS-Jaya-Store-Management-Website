# VS Jaya Electric Inventory System
A Cloud-based Inventory Management and Point of Sale (POS) system for electrical supply stores, powered by Node.js, PostgreSQL, and Supabase.

## Key Features
- **Transaction Recording**: Tracks both Sales and Restock operations seamlessly.
- **Transaction Voiding**: Gracefully cancel and delete transactions with automatic inventory stock restock/reversal.
- **Dynamic History**: Filter transaction history globally through custom date ranges.
- **Low Stock Alerts**: Real-time dashboard indicators for items running out of stock.
- **Serverless Image Compression & Uploads**: Automatically compresses high-res item photos on the client-side to bypass Vercel's 4.5MB payload limit, securely encoding them as `Base64` memory payloads directly into the Postgres database.

## Deployment (Vercel Ready)
This application is strictly engineered to run in a *Serverless/Ephemeral* environment on Vercel.

1. Connect this repository to your Vercel project.
2. Navigate to **Settings > Environment Variables** in your Vercel dashboard.
3. Add a new key named `DATABASE_URL` and paste your Supabase PostgreSQL connection string. 
   > **⚠️ CRITICAL FOR VERCEL**: You MUST use the **Transaction Pooler** port (change `5432` to `6543`) and append `?pgbouncer=true` at the end of the URL to prevent `MaxClientsInSessionMode` connection exhaustion errors.
4. Redeploy.
