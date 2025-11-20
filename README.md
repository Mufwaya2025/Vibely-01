<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Environment Variables

Set up a .env file based on .env.example before running the app.

- GOOGLE_CLIENT_ID / VITE_GOOGLE_CLIENT_ID – Google OAuth 2.0 client for one-click auth.
- LENCO_PUBLIC_KEY - Lenco publishable key used by the inline checkout widget.
- LENCO_SECRET_KEY - Lenco secret/API token used on the server for verification, payouts, and webhooks.
- LENCO_API_BASE - Lenco API base URL (defaults to https://api.lenco.co/access/v2 when unset).
- LENCO_WIDGET_URL / VITE_LENCO_WIDGET_URL - Inline widget script URL (defaults to `https://pay.lenco.co/js/v1/inline.js` in production; sandbox/development still use Lenco’s sandbox URL unless you override).
- LENCO_WITHDRAW_SOURCE_ACCOUNT_ID - Optional source account used when triggering payouts via the API.
- LENCO_ENV - Optional override (`sandbox` or `production`). Defaults to `production`; set to `sandbox` for testing.
- VITE_API_BASE_URL - URL of the Express backend (http://localhost:4000 in local dev).

Restart both 
pm run server:dev and 
pm run dev after changing env values so Vite and the API pick them up.

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1P6jh6kou1nVf5BgLwSBpojY842f9X5Gu

## Run Locally

1. Install dependencies: 
pm install
2. Configure .env as described above.
3. Start the backend API: 
pm run server:dev
4. Start the Vite dev server in a second terminal: 
pm run dev

The frontend proxies API calls to VITE_API_BASE_URL (default http://localhost:4000).

- User accounts (including new signups) are persisted in `data/users.json`. On first run, the file is created with the seeded super admin user (email: mufwaya.zm@gmail.com, password: ew0fwcxs). Keep this file secure in production or swap in your managed database.

## Payments & Payouts

### Ticket checkout
- The purchase modal launches the Lenco inline widget with the event price (default currency ZMW, locale zm).
- On success the frontend calls /api/payments/verify so the server confirms the collection status through Lenco's /collections/status/:reference endpoint before issuing the ticket.
- Webhooks from Lenco (collection.successful) are validated using the HMAC signature and will re-verify transactions if the UI is offline.
- By default the app expects real Lenco credentials; set `LENCO_USE_MOCK_GATEWAY=true` in `.env` if you need to simulate checkout locally without live keys.

### Subscription upgrades
- Upgrading to Pro (SubscriptionModal) now goes through the same Lenco flow. When the payment reports succeeded, the backend extends the organizer's subscription by one month.

### Withdrawals for organizers
- Organizer wallets aggregate ticket sales minus Lenco fees and the platform fee (PlatformSettings.platformFeePercent).
- From the Revenue dashboard an organizer can request a payout. The server calls /transfers on the Lenco API, stores the payout transaction, and updates the available balance so the UI reflects pending and settled payouts.
- GET /api/payments/organizers/:id/balance exposes the breakdown (gross, fees, paid out, pending) and the available balance, while GET /api/payments/organizers/:id/transactions returns a transaction feed for the financial widgets.

### Webhooks
- Configure your Lenco dashboard to post to /api/webhooks/lenco.
- The payload signature is checked with the SHA512 hash of the event body using the derived webhook hash key (SHA256 of your API token).
- Successful events are logged and, for collections, trigger server-side verification.

> **Sandbox**: Set `LENCO_ENV=sandbox` (and optionally override `LENCO_API_BASE` / `LENCO_WIDGET_URL`) if you need to target Lenco's sandbox endpoints for testing. Production keys and endpoints are used by default.

## Production Deployment

To deploy Vibely to a production server with the domain vibelyapp.live:

1. Set up your production environment variables in `.env.production`
2. Build the application: `npm run build`
3. Set NODE_ENV to production: `export NODE_ENV=production`
4. Start the server: `npm start`

The application will serve the built frontend files and API endpoints from the same server. Make sure to update the following environment variables for production:

- CLIENT_ORIGIN - should include your production server address (e.g., http://vibelyapp.live,https://vibelyapp.live)
- VITE_API_BASE_URL - should point to your production server's API (e.g., https://vibelyapp.live:4000 or https://api.vibelyapp.live if using subdomain)

## HTTPS Setup with Let's Encrypt

To enable HTTPS on your domain vibelyapp.live, follow these steps:

1. **Install Certbot** (on Ubuntu/Debian):
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Obtain SSL certificate**:
   ```bash
   sudo certbot --nginx -d vibelyapp.live -d www.vibelyapp.live
   ```

3. **Configure Nginx** (if not automatically configured by Certbot):
   - Use the Nginx configuration provided in the `nginx.conf` file in this repository
   - Make sure to update paths and server details for your specific setup
   - Test the configuration: `sudo nginx -t`
   - Reload Nginx: `sudo systemctl reload nginx`

4. **Automatic renewal**: Certbot sets up a cron job or systemd timer to automatically renew certificates before they expire.

For detailed instructions, see the `CERTBOT_SETUP.md` file in this repository.

## Domain Configuration

1. Point your domain `vibelyapp.live` and `www.vibelyapp.live` to your server's IP address via DNS records
2. Update your environment variables in `.env.production`:
   - CLIENT_ORIGIN=https://vibelyapp.live,https://www.vibelyapp.live
   - VITE_API_BASE_URL=https://vibelyapp.live (or https://api.vibelyapp.live if using subdomain for API)
3. Make sure all required ports (80, 443, and your app port) are open in your firewall
