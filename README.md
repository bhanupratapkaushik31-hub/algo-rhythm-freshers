# ALGO-RHYTHM | CSE Fresher Party 2026 🎉
## Complete Event Registration, Payment, Digital Ticket & QR Check-In System

ALGO-RHYTHM is a complete, production-ready, full-stack event registration and entrance verification platform built for the Department of Computer Science and Engineering's annual Fresher Party on **9 September 2026** at the **Baldev Raj Mittal Unipolis**. 

Designed to support hundreds or thousands of concurrent student checkouts, this platform handles student registrations, online payments via Razorpay, server-side signature verification, transactional email ticket deliveries via Resend, and browser camera QR check-ins for entry coordinators.

---

## 🚀 Tech Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Next.js API Routes (Serverless)
- **Database:** Supabase PostgreSQL (with custom views, sequences, triggers, indices, and RLS policies)
- **Authentication:** Supabase Auth (Admin accounts management)
- **Payments:** Razorpay Checkout SDK & Webhooks
- **Emails:** Resend API (Transactional HTML emails)
- **Exporting:** Browser Blob CSV Engine
- **Scanning:** `html5-qrcode` & browser camera stream
- **Ticketing:** `qrcode` pre-renderer, `html2canvas`, and `jsPDF` for image/PDF exports

---

## 🛠️ Environment Variables Configuration

Create a `.env.local` file in the project root directory. Do **not** commit this file to Git. You can use `.env.example` as a starting template:

```env
# Supabase Project Connection Credentials


# Resend Transactional Email API Key
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Public App Url (No trailing slash)
# Locally: http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🗄️ Database Setup (Supabase)

1. Create a new project in your [Supabase Dashboard](https://supabase.com).
2. Navigate to the **SQL Editor** tab in the sidebar.
3. Open a new query and paste the contents of `supabase/schema.sql` (also saved in `scratch/schema.sql` in artifacts).
4. Run the query. This will automatically set up:
   - Tables: `settings`, `registrations`, `payments`, `entries`, `admins`.
   - Sequence: `ticket_seq` starting at 1.
   - Triggers: `trg_generate_ticket_id` (auto-generates Ticket IDs like `ALG26-CSE-0001`) and `on_auth_user_created` (auto-registers new auth signups in our custom `admins` table).
   - View: `registrations_with_details` (pre-joins student, payment, and check-in logs for fast queries).
   - Indexes on lookup columns for query performance.
   - Row Level Security (RLS) policies protecting admin tables while keeping public reading secure.

---

## 💳 Razorpay Setup

1. Log into your [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Go to **Settings** > **API Keys** and generate a new key set (Test or Live mode). Save `key_id` and `key_secret` to your `.env.local` file.
3. Go to **Settings** > **Webhooks** and click **Add New Webhook**.
4. Set the **Webhook URL** to: `https://<your-deployed-domain>.com/api/payment/webhook` (or use a service like `ngrok` for local webhook testing).
5. Set the **Secret** to a strong random text string and save it to `RAZORPAY_WEBHOOK_SECRET` in your `.env.local`.
6. Under **Active Events**, select:
   - `order.paid` (Primary registration payment webhook confirmation).
7. Save/Create the Webhook.

---

## 📧 Resend Email Setup

1. Log into [Resend](https://resend.com) and create an API key. Save it as `RESEND_API_KEY`.
2. In Resend, go to **Domains** and verify your domain to send from a custom email address.
3. Save your sender address to `RESEND_FROM_EMAIL` (e.g., `ALGO-RHYTHM <noreply@yourdomain.com>`).
4. *For testing without a domain:* You can send to your own account email using Resend's default sandbox address `onboarding@resend.dev`.

---

## 🔐 Admin Accounts Setup

Because public admin registration is disabled for security, administrators must be registered through the Supabase Auth panel:
1. Go to your **Supabase Dashboard** > **Authentication** > **Users**.
2. Click **Add User** > **Create User**.
3. Fill in the email and password.
4. Open the **SQL Editor** in Supabase and run an update query to assign their name and role (default is `scanner` if metadata is not provided):
   ```sql
   UPDATE public.admins 
   SET role = 'super_admin', name = 'Super Coordinator'
   WHERE email = 'your-admin-email@domain.com';
   ```
   *Roles Available:*
   - `super_admin`: Full database access, download metrics, toggle portal lock, cancel registrations.
   - `admin`: Full database access, download metrics, toggle portal lock.
   - `scanner`: Scanner interface only. Checked-in scans database access only (cannot view registration tables).

---

## 💻 Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open your browser at [http://localhost:3000](http://localhost:3000).

---

## 📦 Production Deployment

The project is fully prepared for serverless deployment on **Vercel** or **Cloudflare Pages**:
1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Paste all environment variables under **Environment Variables** in Vercel project settings.
4. Deploy. Vercel will compile and host the App Router serverless endpoints automatically.

---

## 📸 Coordinator QR Scanner & Entry Workflow

1. A student arrives at the venue entrance.
2. The coordinator signs in at `/admin/login` on their mobile phone and navigates to the QR Scanner page.
3. The browser requests camera access. The coordinator scans the student's digital ticket QR code.
4. **Instant Verification:** The scanner plays a beep and triggers haptic vibrations to indicate ticket status:
   - 🟢 **Valid Ticket:** Shows student name, registration number, year, and a green check-in trigger. Click **MARK ENTRY** to confirm.
   - 🟡 **Unpaid Ticket:** Rejects check-in, showing that payment was not verified.
   - 🔴 **Already Entered:** Rejects check-in, showing a warning with the exact check-in timestamp and coordinator name from the first check-in.
   - 🔴 **Invalid Ticket:** Rejects check-in for untrusted/fake tokens.
5. Click **SCAN NEXT TICKET** to start the camera again.

---

## 🔍 Troubleshooting

- **Double check-in race conditions:** PostgreSQL's UNIQUE constraint on `entries(registration_id)` prevents a ticket from being checked in twice, throwing a conflict error even if scanned simultaneously on two coordinator phones.
- **Webhook delays:** If a student closes their tab before signature verification completes, the Razorpay `order.paid` webhook handles verification asynchronously to ensure their registration status is updated to `PAID` and their ticket is delivered via email.
- **Vibration/Audio fails:** Haptic pulses and synthesizer beeps are browser-native features. Audio requires a user interaction on iOS Chrome/Safari to activate. Scanner overrides handle blocked Audio contexts gracefully.
