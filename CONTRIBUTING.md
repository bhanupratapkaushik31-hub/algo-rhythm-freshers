# Contributing to ALGO-RHYTHM 🎉

Thank you for your interest in contributing to **ALGO-RHYTHM — CSE Fresher Party 2026**.

ALGO-RHYTHM is a full-stack event registration, payment, digital ticket, and QR check-in platform built for the Department of Computer Science and Engineering.

We welcome contributions that improve the platform's **reliability, security, performance, accessibility, user experience, and maintainability**.

---

## 📋 Before You Start

Before contributing, please:

1. Read the [`README.md`](./README.md).
2. Understand the project architecture and existing implementation.
3. Check existing Issues and Pull Requests to avoid duplicate work.
4. For major changes, open an Issue or discuss the proposed approach with the maintainers first.

> **Important:** This application handles student registration data, payment information, authentication, and event-entry verification. Changes affecting these systems should be made carefully and tested thoroughly.

---

## 🛠️ Tech Stack

The project is built using:

* **Next.js** — App Router
* **TypeScript**
* **Tailwind CSS**
* **Framer Motion**
* **Supabase PostgreSQL**
* **Supabase Auth**
* **Razorpay** — Payments & Webhooks
* **Resend** — Transactional Emails
* **html5-qrcode** — QR scanning
* **qrcode** — QR generation
* **html2canvas** — Ticket image generation
* **jsPDF** — Ticket PDF generation

---

## 🚀 Getting Started

### 1. Fork the Repository

Fork the repository to your GitHub account and clone it locally.

```bash
git clone https://github.com/YOUR-USERNAME/algo-rhythm-freshers.git
cd algo-rhythm-freshers
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root.

Use the existing `.env.example` as a reference.

```env
RESEND_API_KEY=
RESEND_FROM_EMAIL=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Additional credentials may be required depending on the features being developed, including Supabase and Razorpay credentials.

### 4. Set Up Supabase

Create a development Supabase project and execute:

```text
supabase/schema.sql
```

Do not use the production database for development or testing.

### 5. Start the Development Server

```bash
npm run dev
```

The application will be available at:

```text
http://localhost:3000
```

---

## 🌿 Branching Strategy

Do not make changes directly to `main`.

Create a dedicated branch for your work.

### Feature

```bash
git checkout -b feature/feature-name
```

Example:

```bash
git checkout -b feature/admin-dashboard
```

### Bug Fix

```bash
git checkout -b fix/issue-description
```

Example:

```bash
git checkout -b fix/qr-double-scan
```

### Documentation

```bash
git checkout -b docs/documentation-update
```

### Refactoring

```bash
git checkout -b refactor/component-name
```

Keep branches focused on a single purpose.

---

## 📝 Commit Guidelines

Use clear and descriptive commit messages.

We recommend the following convention:

```text
type: short description
```

### Common Types

| Type       | Purpose                   |
| ---------- | ------------------------- |
| `feat`     | New functionality         |
| `fix`      | Bug fix                   |
| `docs`     | Documentation             |
| `refactor` | Code restructuring        |
| `style`    | UI/formatting changes     |
| `perf`     | Performance improvements  |
| `test`     | Tests                     |
| `chore`    | Maintenance/configuration |
| `security` | Security-related changes  |

### Examples

```bash
git commit -m "feat: add registration confirmation page"
```

```bash
git commit -m "fix: prevent duplicate QR check-in"
```

```bash
git commit -m "security: validate webhook signature"
```

```bash
git commit -m "docs: update Supabase setup instructions"
```

Avoid vague commit messages such as:

```text
update
changes
fixed stuff
final
new code
```

---

## 💻 Coding Guidelines

### TypeScript

* Prefer TypeScript over JavaScript.
* Use meaningful variable and function names.
* Avoid `any` unless there is a strong reason.
* Keep functions focused and reasonably small.
* Reuse existing utilities and components where possible.
* Handle errors explicitly.

### React / Next.js

* Follow the existing App Router structure.
* Prefer Server Components where appropriate.
* Use Client Components only when client-side functionality is required.
* Avoid unnecessary client-side state.
* Keep reusable UI components modular.

### Styling

* Follow the existing Tailwind CSS conventions.
* Reuse existing design patterns and components.
* Maintain responsive behavior across desktop and mobile.
* Do not introduce a new styling system without discussing it first.

---

## 🗄️ Database Contributions

Database changes require additional care.

The project uses **Supabase PostgreSQL** with:

* Tables
* Views
* Sequences
* Triggers
* Indexes
* Row Level Security (RLS)
* Authentication integration

When modifying the database:

1. Update the appropriate SQL schema/migration.
2. Consider existing data and relationships.
3. Check indexes and query performance.
4. Review RLS policies.
5. Test authorization for every affected role.
6. Verify that existing functionality still works.

### Never

* Drop production tables.
* Disable RLS to "make something work."
* Commit database credentials.
* Expose service-role credentials to the browser.
* Modify production data while testing.

---

## 🔐 Security Guidelines

Security is especially important because ALGO-RHYTHM handles registration information, authentication, payments, and event-entry verification.

### Never Commit Secrets

Do not commit:

```text
.env
.env.local
.env.production
API keys
Razorpay secrets
Supabase service-role keys
Resend API keys
Webhook secrets
Authentication credentials
```

Use environment variables instead.

### Payment Security

Payment verification must always be performed server-side.

Do not trust payment status supplied directly by the client.

Razorpay webhook signatures must be properly verified before processing webhook events.

### Authentication & Authorization

Admin functionality must respect the project's role system:

* `super_admin`
* `admin`
* `scanner`

Do not expose administrative functionality to unauthorized users.

### QR Check-In

QR data should never be treated as proof of payment or registration by itself.

The server/database must remain the source of truth for:

* Registration status
* Payment status
* Entry status
* Ticket validity

---

## 💳 Working With Razorpay

When developing payment functionality:

* Use Razorpay **Test Mode**.
* Never test using real student payments.
* Never commit Razorpay credentials.
* Verify payment signatures server-side.
* Test webhook handling independently.
* Consider duplicate webhook delivery and retry scenarios.

Changes to payment flows should include appropriate testing before being merged.

---

## 📧 Working With Resend

For email-related development:

* Use a development/test sender where possible.
* Do not expose the Resend API key to the client.
* Avoid sending unnecessary emails during testing.
* Verify ticket generation before sending emails.

---

## 📱 QR Scanner Development

The QR scanner is intended for mobile browser usage at the event entrance.

When modifying the scanner:

* Test on a physical mobile device where possible.
* Verify camera permissions.
* Test valid tickets.
* Test unpaid tickets.
* Test already-used tickets.
* Test invalid/fake QR codes.
* Test repeated scans.
* Test simultaneous scans from multiple devices.
* Verify audio and haptic fallback behavior.

The database must prevent duplicate check-ins even if two coordinators scan the same ticket simultaneously.

---

## 🧪 Testing

Before submitting a Pull Request, test the affected functionality thoroughly.

At minimum, verify:

* Application starts successfully.
* No TypeScript errors are introduced.
* No obvious console errors are present.
* Existing functionality still works.
* Mobile and desktop layouts remain usable.
* Authentication/authorization behaves correctly.
* Database operations behave correctly.
* Sensitive information is not exposed.

For changes involving payments, authentication, database access, or QR check-in, additional manual testing is expected.

---

## 🔍 Pull Request Process

Before opening a Pull Request:

```bash
git pull origin main
```

Resolve any conflicts and ensure your branch is up to date.

Then push your branch:

```bash
git push origin feature/your-feature-name
```

Create a Pull Request targeting:

```text
main
```

### Your Pull Request should include

* Clear title
* Description of the change
* Reason for the change
* Related Issue, if applicable
* Testing performed
* Screenshots/videos for UI changes
* Any database or environment-variable changes

### Example PR Title

```text
feat: add coordinator attendance dashboard
```

### Example PR Description

```text
## What changed?

Added a coordinator dashboard showing today's verified entries.

## Why?

Coordinators need a quick overview of event check-ins.

## Testing

- Tested on Chrome desktop
- Tested on Android Chrome
- Verified scanner permissions
- Verified duplicate check-in handling

## Related Issue

Closes #24
```

---

## 🐛 Reporting Bugs

When opening a bug report, provide as much relevant information as possible.

Include:

* Clear description of the issue
* Steps to reproduce
* Expected behavior
* Actual behavior
* Browser/device
* Screenshots or screen recordings
* Relevant error messages
* Whether the issue is reproducible

### Example

```text
## Bug

QR scanner does not restart after an invalid ticket.

## Steps to Reproduce

1. Open the coordinator scanner.
2. Scan an invalid QR code.
3. Attempt to scan another ticket.

## Expected

The scanner should allow another scan.

## Actual

The scanner remains in the previous state.

## Environment

Android 15
Chrome
```

---

## 💡 Feature Requests

For major feature requests, open an Issue before implementing the feature.

Explain:

* What problem the feature solves
* Proposed solution
* Expected user behavior
* Potential impact on existing functionality
* Any database/API changes required

---

## 🎨 UI/UX Contributions

For UI changes:

* Maintain the existing ALGO-RHYTHM visual identity.
* Ensure responsive layouts.
* Consider mobile users, especially coordinators using the QR scanner.
* Maintain accessibility where practical.
* Avoid unnecessary animations or visual complexity.
* Test different screen sizes.

---

## ⚡ Performance

ALGO-RHYTHM is designed to support a large number of concurrent registrations.

Performance-sensitive changes should consider:

* Database query efficiency
* Appropriate indexes
* Serverless execution limits
* API response times
* Unnecessary client-side requests
* Large payloads
* Image/PDF generation
* Concurrent payment/check-in operations

Do not sacrifice correctness or security for small performance gains.

---

## 🔄 Database & Concurrent Operations

Particular attention should be given to operations that may happen concurrently.

For example, two coordinator devices may attempt to check in the same ticket at almost the same time.

Application-level checks alone are not sufficient for such operations.

Database constraints and transactions should be used where appropriate to maintain data integrity.

---

## 📦 Adding Dependencies

Before adding a new npm package:

1. Check whether the functionality can be implemented using existing dependencies.
2. Consider package size and maintenance.
3. Check licensing and security.
4. Explain the reason for the dependency in the Pull Request.

Avoid adding dependencies for trivial functionality.

---

## 🚫 What Not to Submit

Please do not submit:

* Hardcoded credentials
* API keys or secrets
* Production database dumps
* Student personal/payment data
* Unrelated formatting changes
* Generated build files
* Debugging code
* Unnecessary dependencies
* Changes that bypass authentication or authorization
* Changes that disable security controls
* Direct modifications to production data

---

## 📜 License

By contributing to ALGO-RHYTHM, you agree that your contributions may be incorporated into the project under its applicable license and project terms.

---

## 🤝 Code of Conduct

All contributors are expected to communicate respectfully and professionally.

Harassment, discrimination, personal attacks, malicious behavior, and intentionally disruptive contributions are not acceptable.

---

## ❤️ Thank You

Every contribution helps make ALGO-RHYTHM more reliable and useful.

Whether you're fixing a typo, improving the UI, optimizing a database query, fixing a bug, or building a new feature — **thank you for contributing!**

**ALGO-RHYTHM | CSE Fresher Party 2026 🎉**
