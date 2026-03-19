# Jaya Electric Inventory System
A Cloud-based Inventory Management and Point of Sale (POS) system for electrical supply stores, powered by Node.js, PostgreSQL, and Supabase.

## Key Features
- **Transaction Recording**: Tracks both Sales and Restock operations seamlessly.
- **Dynamic History**: Filter transaction history globally through custom date ranges.
- **Low Stock Alerts**: Real-time dashboard indicators for items running out of stock.
- **Serverless Image Uploads**: Bypasses ephemeral disk limitations by securely encoding item photos as `Base64` memory payloads directly into the Postgres database.

## Deployment (Vercel Ready)
This application is strictly engineered to run in a *Serverless/Ephemeral* environment on Vercel.

1. Connect this repository to your Vercel project.
2. Navigate to **Settings > Environment Variables** in your Vercel dashboard.
3. Add a new key named `DATABASE_URL` and paste the Pooler Connection String from your Supabase PostgreSQL instance.
4. Redeploy.
