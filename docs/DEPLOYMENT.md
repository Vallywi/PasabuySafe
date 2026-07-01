# PasabuySafe — Deployment Guide

---

## 1. Deployment Overview

| Component | Platform | URL Pattern |
|-----------|----------|-------------|
| Smart Contract | Stellar Testnet/Mainnet | Contract ID (C...) |
| Frontend | Vercel | pasabuysafe.app |
| Database + Auth | Supabase | xxx.supabase.co |
| Images/Files | Supabase Storage | xxx.supabase.co/storage |
| Edge Functions | Supabase Functions | xxx.supabase.co/functions |
| Domain | Namecheap/Cloudflare | pasabuysafe.app |

---

## 2. Prerequisites

```bash
# Tools you need installed
node --version      # v18+ required
npm --version       # v9+
rust --version      # stable (1.75+)
stellar --version   # v27+
supabase --version  # v1.100+
vercel --version    # latest

# Install if missing
npm install -g vercel supabase
cargo install --locked stellar-cli
rustup target add wasm32v1-none
```

---

## 3. Step 1 — Supabase Setup

### 3.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. **Name**: `pasabuy-safe`
4. **Region**: Southeast Asia (Singapore) — closest to Filipino users
5. **Database Password**: Generate a strong one, save it
6. Wait for project to provision (~2 minutes)

### 3.2 Get Your Keys

From Project Settings → API:
```
SUPABASE_URL = https://xxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOi...  (public, safe for frontend)
SUPABASE_SERVICE_KEY = eyJhbGciOi... (secret, only for Edge Functions)
```

### 3.3 Run Database Migrations

```bash
# In your project root
supabase init
supabase link --project-ref <your-project-ref>

# Push the schema (from DATABASE.md)
supabase db push
```

Or manually run the SQL from `docs/DATABASE.md` in the Supabase SQL Editor.

### 3.4 Configure Auth Providers

In Supabase Dashboard → Authentication → Providers:

**Email (already enabled by default):**
- Enable "Confirm email" = ON
- Set site URL: `https://pasabuysafe.app`
- Set redirect URLs: `https://pasabuysafe.app/auth/callback`

**Google OAuth:**
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Authorized redirect URI: `https://xxxxxxxxxx.supabase.co/auth/v1/callback`
4. Copy Client ID + Client Secret into Supabase

**Facebook OAuth:**
1. Go to Facebook Developers → Create App → Consumer
2. Add Facebook Login product
3. Valid OAuth redirect URI: `https://xxxxxxxxxx.supabase.co/auth/v1/callback`
4. Copy App ID + App Secret into Supabase

### 3.5 Customize Email Templates

In Supabase Dashboard → Authentication → Email Templates:

**Confirmation email:**
```html
<h2>Welcome to PasabuySafe! 🛡️</h2>
<p>Hi {{ .Email }},</p>
<p>Click below to confirm your account and start group buying with confidence:</p>
<a href="{{ .ConfirmationURL }}" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
  Confirm My Account
</a>
<p>Your money is always safe with PasabuySafe.</p>
```

**Password reset:**
```html
<h2>Reset Your Password 🔑</h2>
<p>Hi {{ .Email }},</p>
<p>Click below to set a new password:</p>
<a href="{{ .ConfirmationURL }}" style="background: #3B82F6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
  Reset Password
</a>
```

### 3.6 Create Storage Buckets

In Supabase Dashboard → Storage:

1. Create bucket: `group-buy-images` (Public)
2. Create bucket: `avatar-images` (Public)
3. Create bucket: `chat-attachments` (Private — authenticated only)

Set policies:
```sql
-- Public read for group-buy-images
CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (bucket_id = 'group-buy-images');
CREATE POLICY "Auth upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'group-buy-images' AND auth.uid() IS NOT NULL);

-- Same for avatar-images
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatar-images');
CREATE POLICY "Auth upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatar-images' AND auth.uid() IS NOT NULL);
```

### 3.7 Deploy Edge Functions

```bash
# Set secrets
supabase secrets set STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
supabase secrets set CONTRACT_ID=CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB

# Deploy functions
supabase functions deploy link-wallet
supabase functions deploy sync-events
supabase functions deploy send-notification
```

### 3.8 Set Up Cron (Event Syncer)

In Supabase Dashboard → Database → Extensions, enable `pg_cron`.

Then run:
```sql
SELECT cron.schedule(
  'sync-stellar-events',
  '*/30 * * * * *',  -- Every 30 seconds
  $$SELECT net.http_post(
    url := 'https://xxxxxxxxxx.supabase.co/functions/v1/sync-events',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
  );$$
);
```

---

## 4. Step 2 — Smart Contract Deployment

### 4.1 Testnet (Already Done)

```bash
cd pasabuy_safe

# Build
stellar contract build

# Deploy (already deployed)
stellar contract alias ls
# Output: pasabuy-safe: CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB
```

### 4.2 Mainnet (When Ready)

```bash
# Configure mainnet network
stellar network add mainnet \
  --rpc-url https://soroban.stellar.org:443 \
  --network-passphrase "Public Global Stellar Network ; September 2015"

# Generate or use existing mainnet deployer key
stellar keys generate mainnet-deployer --network mainnet
stellar keys fund mainnet-deployer --network mainnet  # Won't work on mainnet — fund manually

# Fund the account via:
# - Stellar Laboratory (lab.stellar.org)
# - Exchange withdrawal
# - Another funded account

# Deploy to mainnet
stellar contract deploy \
  --wasm target/wasm32v1-none/release/pasabuy_safe.wasm \
  --source mainnet-deployer \
  --network mainnet \
  --alias pasabuy-safe-mainnet

# SAVE THE CONTRACT ID — this is your production contract
stellar contract alias ls
```

⚠️ **Before mainnet deployment:**
- Complete security audit
- Test extensively on testnet
- Have a funding plan for the deployer account
- Document the deployer key storage (hardware wallet recommended)

---

## 5. Step 3 — Frontend Deployment (Vercel)

### 5.1 Create the Next.js Project

```bash
npx create-next-app@latest pasabuy-safe-web --typescript --tailwind --app --src-dir
cd pasabuy-safe-web

# Install dependencies
npm install @stellar/stellar-sdk @stellar/freighter-api @supabase/supabase-js zustand framer-motion gsap @rive-app/react-canvas lottie-react canvas-confetti @react-spring/web

# Install shadcn/ui
npx shadcn-ui@latest init
```

### 5.2 Environment Variables

Create `.env.local`:
```env
# Stellar
NEXT_PUBLIC_CONTRACT_ID=CBSPN43EXNZVIK3QHZ6LVGAQUU5KIWAH6JM2UGUK5IS6VCVJRV4Y7OKB
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# App
NEXT_PUBLIC_APP_URL=https://pasabuysafe.app
NEXT_PUBLIC_STELLAR_EXPERT_URL=https://stellar.expert/explorer/testnet
```

### 5.3 Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy (first time — sets up project)
vercel deploy

# Set environment variables on Vercel
vercel env add NEXT_PUBLIC_CONTRACT_ID
vercel env add NEXT_PUBLIC_NETWORK_PASSPHRASE
vercel env add NEXT_PUBLIC_RPC_URL
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY

# Deploy to production
vercel deploy --prod
```

### 5.4 Custom Domain

1. Buy domain: `pasabuysafe.app` (Namecheap, ~$15/year)
2. In Vercel → Project Settings → Domains → Add `pasabuysafe.app`
3. Update DNS records as Vercel instructs (A record or CNAME)
4. Wait for SSL certificate (automatic, ~5 minutes)
5. Update Supabase redirect URLs to use the custom domain

### 5.5 Vercel Configuration

Create `vercel.json` in project root:
```json
{
  "framework": "nextjs",
  "regions": ["sin1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

---

## 6. Step 4 — Connect Everything

### 6.1 Update Supabase Auth Settings

After deploying frontend:
- Site URL: `https://pasabuysafe.app`
- Redirect URLs:
  - `https://pasabuysafe.app/auth/callback`
  - `https://pasabuysafe.app/reset-password`
  - `http://localhost:3000/auth/callback` (for local dev)

### 6.2 CORS (Supabase Edge Functions)

Edge Functions automatically handle CORS for your Supabase project URL. If using a custom domain, add it:

```typescript
// In each edge function
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://pasabuysafe.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### 6.3 Verify End-to-End

```bash
# 1. Frontend loads
curl -I https://pasabuysafe.app

# 2. Supabase responds
curl https://xxxxxxxxxx.supabase.co/rest/v1/group_buys?limit=1 \
  -H "apikey: YOUR_ANON_KEY"

# 3. Contract is accessible
stellar contract invoke --id pasabuy-safe --network testnet -- \
  --help
```

---

## 7. CI/CD Pipeline (GitHub Actions)

### `.github/workflows/deploy.yml`

```yaml
name: Deploy PasabuySafe

on:
  push:
    branches: [main]

jobs:
  test-contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32v1-none
      - run: cargo test
      - run: stellar contract build

  deploy-frontend:
    needs: test-contract
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: cd pasabuy-safe-web && npm ci && npm run build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  deploy-supabase:
    needs: test-contract
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
      - run: supabase db push
      - run: supabase functions deploy link-wallet
      - run: supabase functions deploy sync-events
```

---

## 8. Monitoring & Observability

| What | Tool | Setup |
|------|------|-------|
| Frontend errors | Vercel Analytics (built-in) | Automatic |
| Frontend performance | Vercel Speed Insights | Enable in dashboard |
| Database monitoring | Supabase Dashboard → Reports | Automatic |
| Edge Function logs | Supabase Dashboard → Functions → Logs | Automatic |
| Contract events | Stellar Expert | Bookmark contract URL |
| Uptime | UptimeRobot (free) | Add `https://pasabuysafe.app` |
| Error tracking | Sentry (optional) | `npm install @sentry/nextjs` |

---

## 9. Checklist Before Going Live

### Smart Contract
- [ ] All 5 tests pass (`cargo test`)
- [ ] Contract builds (`stellar contract build`)
- [ ] Deployed to testnet and verified on Stellar Expert
- [ ] Security audit completed (for mainnet)
- [ ] Deployer key stored securely

### Supabase
- [ ] All tables created with correct schema
- [ ] RLS policies enabled on all tables
- [ ] Auth providers configured (email, Google, Facebook)
- [ ] Email templates customized
- [ ] Edge Functions deployed and tested
- [ ] Cron job for event sync running
- [ ] Storage buckets created with policies

### Frontend
- [ ] Deployed to Vercel with custom domain
- [ ] SSL certificate active
- [ ] Environment variables set
- [ ] Email signup/login works
- [ ] Google/Facebook OAuth works
- [ ] Freighter wallet connection works
- [ ] Link wallet flow works
- [ ] Deposit, confirm, refund all work on testnet
- [ ] Animations load without blocking
- [ ] Mobile responsive
- [ ] SEO meta tags set
- [ ] Open Graph images for social sharing

### DNS & Domain
- [ ] Domain registered (pasabuysafe.app)
- [ ] DNS pointing to Vercel
- [ ] SSL certificate provisioned
- [ ] Redirect URLs updated in Supabase

---

## 10. Cost Estimate (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby (free) → Pro ($20/mo at scale) | $0 - $20 |
| Supabase | Free tier (500MB, 50K MAU) → Pro ($25/mo) | $0 - $25 |
| Domain | .app domain | ~$1.25/mo ($15/year) |
| Stellar | Transaction fees (~0.00001 XLM each) | ~$0 |
| UptimeRobot | Free tier | $0 |
| **Total (MVP)** | | **$0 - $1.25/mo** |
| **Total (Growth)** | | **$45 - $70/mo** |

The MVP can run entirely on free tiers. You only pay for the domain.
