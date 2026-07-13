# Paperspace

Paperspace is an advanced intelligent document & workflow automation platform built with modern web technologies. It significantly simplifies document generation, template management, and automated form-to-document mapping by providing a seamless, real-time collaboration environment.

Originally developed as a final-year thesis (skripsi) project at Jurusan Teknik Informatika dan Komputer, Politeknik Negeri Jakarta (PNJ), this repository is being handed over to the department for continued maintenance and development.

**Maintainer / original author contact:** mr.auriorajaa@gmail.com

## 🚀 Features

- **Advanced Document Templating**: Native support for DOCX, PDF, and XLSX files. Automatically merge data into templates.
- **Form-to-Document Automation**: Seamless integration allowing seamless mapping of form submissions directly onto customized document templates.
- **Embedded Document Editing**: Fully integrated OnlyOffice editor (`@onlyoffice/document-editor-react`) to view and edit documents dynamically directly in the browser without context switching.
- **Real-Time Data Sync**: Powered by Convex to enable real-time backend updates and blazing-fast data syncing across devices.
- **Secure Authentication and Storage**: Complete single sign-on capabilities using Clerk, tightly integrated with scalable blob storage (`@vercel/blob`).
- **Modern, Accessible UI**: A beautiful, responsive interface utilizing Tailwind CSS, Lucide Icons, and heavily inspired by shadcn/ui and Radix UI.
- **PDF & Word Engine**: In-browser document manipulation via specialized engines such as `pdf-lib`, `pdfjs-dist`, `docxtemplater`, and `mammoth`.
- **Automatic Field Detection**: Rule-based detection of fillable fields on both placeholder-tagged and raw administrative documents (see thesis report for algorithm details).
- **Document Summarization**: Optional integration with an external IndoBERT-based summarization microservice via async webhook callback.

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org) (React 19)
- **Backend & Database**: [Convex](https://www.convex.dev/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) / Radix UI
- **Document Processing**: OnlyOffice Document Server, PDF.js, docxtemplater, pdf-lib, mammoth
- **Storage**: Vercel Blob
- **Email**: Nodemailer (SMTP)
- **AI Services**: Google Gemini (offline/automated detection fallback), external IndoBERT summarizer (separate service, not included in this repo)

## 🧩 Architecture & Workspace Structure

- `app/` - Next.js App Router (Auth flow, Main workspace UI, API endpoints, webhooks)
- `components/` - Global reusable React components & specialized integrations (OnlyOfficeEditor, previews)
- `contexts/` - Global React contexts (Theme, etc.)
- `convex/` - Convex backend codebase including schema definitions, queries, mutations, and recurring cron jobs.
- `lib/` - Specialized utilities for document generation, placeholder detection, template processing, etc.

At a high level, the system is a 6-layer architecture:

1. **Client Layer** – user's browser
2. **Presentation Layer** – Next.js frontend + embedded OnlyOffice editor component
3. **Application Layer** – Next.js API routes / Convex functions (API endpoints)
4. **Business Logic Layer** – Auth, Editor, Template, Document, and Form modules
5. **Data & Storage Layer** – Convex database + Convex file storage
6. **External Services Layer** – Clerk, OnlyOffice Document Server, Google APIs, Vercel Blob

---

## 📦 Prerequisites

Before you start, make sure you (or the person setting this up) have:

- **Node.js** >= 20 and npm (or yarn / pnpm / bun)
- **Docker** (for self-hosting OnlyOffice Document Server) — Docker Desktop on Windows/Mac, or Docker Engine on Linux
- **Git**
- A way to expose your local OnlyOffice server to the internet with a stable HTTPS URL (see [OnlyOffice networking](#4-onlyoffice-document-server-docker) below) — e.g. a **Cloudflare Tunnel**, ngrok, or a real server/VPS with a domain
- Accounts on the following services (all have free tiers sufficient for this project):
  - [Convex](https://www.convex.dev/)
  - [Clerk](https://clerk.com/)
  - [Google Cloud Console](https://console.cloud.google.com/) (for Google OAuth + Drive/Forms API)
  - [Google AI Studio](https://aistudio.google.com/) (for Gemini API key)
  - [Vercel](https://vercel.com/) (for Blob storage, and optionally for hosting the app itself)
  - A Gmail account (for sending email notifications via SMTP)

> ⚠️ **Security note:** None of the values below should ever be committed to the repository or shared in chat/screenshots. Every secret referenced in this README must be generated fresh by whoever deploys this project. If any of the old keys from the original development environment were ever shared outside the team, they should be **revoked and regenerated** in their respective dashboards (Clerk, Google Cloud, Vercel, etc.) before this handover is considered complete.

---

## ⚙️ Full Environment Variable Reference

This project uses **two separate places** for environment variables:

1. **Convex Dashboard** → Settings → Environment Variables (used by backend functions in `convex/`)
2. **`.env.local`** in the project root (used by the Next.js frontend/API routes)

Some variables (like the ones prefixed `NEXT_PUBLIC_`) are exposed to the browser — never put real secrets in a `NEXT_PUBLIC_` variable.

### 1. Convex (Database, Backend Functions, Real-Time Sync)

Convex provides both the database and the deployment tooling.

1. Install the Convex CLI as a dev dependency (already in `package.json`) and log in:
   ```bash
   npx convex login
   ```
2. From the project root, run:
   ```bash
   npx convex dev
   ```
   The first time you run this, the CLI will prompt you to create a new **team** and **project** (or select an existing one). Once created, it automatically writes the following into `.env.local` for you:
   ```
   CONVEX_DEPLOYMENT=dev:<your-deployment-name> # team: <your-team>, project: paperspace
   CONVEX_DEPLOY_KEY=<generated automatically, dev only>
   NEXT_PUBLIC_CONVEX_URL=https://<your-deployment-name>.convex.cloud
   NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-deployment-name>.convex.site
   ```
   You do **not** need to manually create these — just run `npx convex dev` and keep the terminal running while developing (it also watches `convex/` for changes and pushes them automatically).
3. For a **production deployment**, run `npx convex deploy` from your CI/CD or manually, and get a separate production `CONVEX_DEPLOY_KEY` from the Convex dashboard under Settings → Deploy Keys.
4. In the **Convex Dashboard** (not `.env.local`!), go to your project → Settings → Environment Variables and add:
   - `CLERK_JWT_ISSUER_DOMAIN` (see Clerk setup below)
   - `INTERNAL_SECRET` (see [Internal Secrets](#6-internal-secrets-self-generated) below)
   - `INTERNAL_API_SECRET` (see [Internal Secrets](#6-internal-secrets-self-generated) below)
   - `SUMMARIZER_CALLBACK_SECRET` (see [Summarizer Integration](#7-summarizer-ml-service-integration) below)

   These four must be set **in the Convex dashboard directly** — they are read by Convex backend functions, not by the Next.js frontend, so putting them only in `.env.local` will not work (this was a real issue encountered during development: a missing `SUMMARIZER_CALLBACK_SECRET` in the Convex dashboard silently rejected summarizer callbacks with no visible error on the frontend — always double check this if a webhook seems to silently fail).

### 2. Clerk (Authentication)

1. Create a new application at [dashboard.clerk.com](https://dashboard.clerk.com/).
2. Choose **Email** (and optionally Google) as a sign-in method.
3. From **API Keys**, copy:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
   CLERK_SECRET_KEY=sk_test_xxxxxxxx
   ```
   (Use the `pk_live_` / `sk_live_` pair instead when deploying to production.)
4. Go to **Configure → JWT Templates → New Template → Convex** (Clerk has a built-in Convex template). Save it, then copy the **Issuer** URL shown there:
   ```
   CLERK_JWT_ISSUER_DOMAIN=https://xxxxxxxx.clerk.accounts.dev
   ```
   Add this same value to the **Convex Dashboard** environment variables (not just `.env.local`) — Convex uses it to validate the JWT on every authenticated request.
5. Add the routing variables (these can stay as-is unless you customize the auth pages):
   ```
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
   ```
6. In `convex/auth.config.ts` (already present in the repo), make sure the issuer domain matches what you configured in Clerk.
7. **(Recommended for institutional handover)** Restrict sign-ups to a specific email domain (e.g. `@ttik.pnj.ac.id`) via Clerk's **Restrictions** settings, so only institution accounts can register. This was flagged as a requested improvement during UAT.

### 3. Google OAuth + APIs (Drive Picker & Google Forms integration)

Used for letting users pick files from Google Drive and pull responses from Google Forms.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or reuse an existing one).
2. Enable these APIs under **APIs & Services → Library**:
   - Google Drive API
   - Google Picker API
   - Google Forms API
3. Go to **APIs & Services → OAuth consent screen**:
   - Set User Type to **Internal** if this is only for PNJ staff with Google Workspace accounts, or **External** + add test users otherwise.
   - Add the scopes needed for Drive (read-only) and Forms (read-only).
   - If publishing externally with sensitive scopes, Google requires an app verification review — budget a few days for this if it applies to you.
4. Go to **Credentials → Create Credentials → OAuth Client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `https://<your-domain>/api/google/callback` (use `http://localhost:3000/api/google/callback` for local dev)
5. Copy the generated values:
   ```
   GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
   GOOGLE_REDIRECT_URI=https://<your-domain>/api/google/callback
   ```
6. Go to **Credentials → Create Credentials → API Key** and restrict it to the Drive/Picker APIs:
   ```
   NEXT_PUBLIC_GOOGLE_API_KEY=AIzaxxxxxxxx
   ```

### 4. Gemini API (Google AI Studio)

Used as an automated/offline detection fallback.

1. Go to [aistudio.google.com](https://aistudio.google.com/) → **Get API key** → create a new key (can reuse the same Google Cloud project as above, or a separate one).
2. Add to `.env.local`:
   ```
   GEMINI_API_KEY=AIzaxxxxxxxx
   GEMINI_MODEL=gemini-2.5-flash-lite
   OFFLINE_DETECTION=false
   ```
   Set `OFFLINE_DETECTION=true` only if you want to bypass Gemini calls entirely and rely purely on the rule-based detection engine in `lib/`.

### 5. OnlyOffice Document Server (Docker)

OnlyOffice is what powers the in-browser collaborative document editor. It runs as a **separate server**, not inside the Next.js app, and the Next.js app talks to it over HTTP(S).

**Step 1 — Generate a JWT secret.** OnlyOffice uses this to sign requests between itself and your app so random people can't hit your document server directly. Generate a fresh random string yourself, e.g.:
```bash
openssl rand -hex 32
```
Keep this value — you'll use it in both the Docker command below and in your `.env.local` as `ONLYOFFICE_JWT_SECRET`.

**Step 2 — Run the container:**
```bash
docker run -d \
  -p 80:80 \
  -e JWT_ENABLED=true \
  -e JWT_SECRET=<paste-your-generated-secret-here> \
  -e JWT_HEADER=Authorization \
  -e ALLOW_PRIVATE_IP_ADDRESS=true \
  -v onlyoffice_data:/var/www/onlyoffice/Data \
  -v onlyoffice_logs:/var/log/onlyoffice \
  --name onlyoffice \
  --restart=always \
  onlyoffice/documentserver
```
Flag notes:
- `JWT_ENABLED=true` + `JWT_SECRET` — required so the editor and callback requests are authenticated. This must be the **same secret** as `ONLYOFFICE_JWT_SECRET` in your app's `.env.local`.
- `ALLOW_PRIVATE_IP_ADDRESS=true` — needed if your Next.js app calls OnlyOffice over a private/LAN IP (e.g. during local development) instead of a public domain.
- The two named volumes persist OnlyOffice's internal data and logs across container restarts — don't skip these, or you'll lose document server state on every restart.
- `-p 80:80` exposes it on port 80. Change the host-side port (the first `80`) if that port is already in use on your machine, e.g. `-p 8080:80`.

**Step 3 — Make it reachable from your app.** This is the part that trips people up most:
- If you're running everything on **one LAN** (e.g. a PC on the same network as your dev machine), you can just use that machine's LAN IP:
  ```
  NEXT_PUBLIC_ONLYOFFICE_SERVER_URL=http://192.168.x.x:80
  NEXT_PUBLIC_APP_URL=http://192.168.x.x:3000
  ```
  Both URLs need to be reachable by whoever is opening the editor in their browser, **and** OnlyOffice's server itself needs to be able to reach your Next.js app's callback URL (since it calls back to save documents) — so pure `localhost` addresses on either side will not work for the other party.
- For anything beyond a single LAN (recommended for department use), put OnlyOffice behind a real domain with HTTPS. A **Cloudflare Tunnel** is a simple way to do this without a static public IP or opening firewall ports:
  ```bash
  cloudflared tunnel --url http://localhost:80
  ```
  or set up a named tunnel pointed at a subdomain like `onlyoffice.yourdomain.tld`. Then:
  ```
  NEXT_PUBLIC_ONLYOFFICE_SERVER_URL=https://onlyoffice.yourdomain.tld
  ```
- ⚠️ **Known issue:** Some browsers (Brave, and some ad-blocker configurations in Chrome/Firefox) block OnlyOffice's internal `Analytics.js` script by default, which can break the editor from loading. If the editor fails silently in a particular browser, check the browser console for a blocked script first before assuming the server config is wrong.

**Step 4 — Add to `.env.local`:**
```
ONLYOFFICE_JWT_SECRET=<same secret as Step 1>
NEXT_PUBLIC_ONLYOFFICE_SERVER_URL=http://192.168.x.x:80    # or your HTTPS tunnel/domain
NEXT_PUBLIC_APP_URL=http://192.168.x.x:3000                 # or your app's public URL
```

### 6. Vercel Blob (File Storage)

1. Go to your project on [vercel.com](https://vercel.com/) → **Storage → Create Database → Blob**.
2. Copy the generated read/write token:
   ```
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx
   ```
3. ⚠️ **Known issue:** Blob tokens can be invalidated/rotated by Vercel (e.g. after certain project or team changes). If uploads suddenly start failing with an auth error, regenerate this token first before debugging further.

### 7. Internal Secrets (self-generated)

These are **not** issued by any external service — you generate them yourself and they just need to match between the places that use them. Use a secure random generator for each, e.g.:
```bash
openssl rand -hex 32
```

| Variable | Where it's used | Notes |
|---|---|---|
| `CRON_SECRET` | `.env.local` | Authenticates scheduled/cron-triggered internal API routes (e.g. Google Forms polling) so they can't be triggered by outsiders. |
| `INTERNAL_SECRET` | `.env.local` **and** Convex Dashboard | Shared secret between the Next.js app and Convex functions for internal-only calls. Must match in both places. |
| `INTERNAL_API_SECRET` | `.env.local` **and** Convex Dashboard | Separate internal secret used for a different internal API boundary (see `lib/` and `convex/` for exact usage) — again, must match in both places. |
| `ONLYOFFICE_JWT_SECRET` | `.env.local` **and** the Docker container's `JWT_SECRET` | See [OnlyOffice setup](#5-onlyoffice-document-server-docker) above — must match exactly. |

### 8. Summarizer / ML Service Integration

Document summarization is handled by a **separate microservice** (built independently, based on IndoBERT) that is not part of this repository. This app only needs to know how to reach it and how to authenticate its callback:

```
SUMMARIZER_API_URL=https://<wherever-the-ml-service-is-hosted>
SUMMARIZER_CALLBACK_SECRET=<a random secret, must match what the ML service sends back>
```

`SUMMARIZER_CALLBACK_SECRET` must be set on **both sides**: in this app's Convex Dashboard environment variables, and configured into the summarizer microservice so it signs its callback requests with the same value. If this value is missing on the Convex side, the callback endpoint will silently reject the summarizer's responses (no visible error on the frontend) — this was a real production issue encountered previously, so it's worth double-checking first if summaries never seem to complete.

If the department does not have access to that separate ML service/repository, this feature can simply be left unconfigured — the rest of the platform (templating, editing, form automation) works independently of it.

### 9. Email Notifications (SMTP)

Used for sending system notification emails (e.g. inactive account warnings from the admin module).

1. Use a Gmail account dedicated to the app (not a personal one, ideally something like a shared department account).
2. Enable 2-Step Verification on that account, then generate an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (regular Gmail passwords will not work with SMTP).
3. Add to `.env.local`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-department-account@gmail.com
   SMTP_PASS=<the 16-character app password, no spaces>
   NOTIFICATION_EMAIL_FROM=no-reply@yourdomain.tld
   ```
   `NOTIFICATION_EMAIL_FROM` is just the display "from" address in the email header — it does not need to be a real inbox, but using a domain you actually control improves deliverability and avoids spam flags.

---

## 📋 Full `.env.local` Template

Putting it all together, your `.env.local` should look like this (all values below are placeholders — replace every one of them):

```shellscript
# Convex — auto-generated by `npx convex dev`, do not hand-edit
CONVEX_DEPLOYMENT=dev:your-deployment-name # team: your-team, project: paperspace
CONVEX_DEPLOY_KEY=dev:your-deployment-name|xxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_CONVEX_URL=https://your-deployment-name.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment-name.convex.site

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxx
CLERK_JWT_ISSUER_DOMAIN=https://xxxxxxxx.clerk.accounts.dev
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Google OAuth + APIs
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
GOOGLE_REDIRECT_URI=https://your-domain.tld/api/google/callback
NEXT_PUBLIC_GOOGLE_API_KEY=AIzaxxxxxxxx

# Gemini
GEMINI_API_KEY=AIzaxxxxxxxx
GEMINI_MODEL=gemini-2.5-flash-lite
OFFLINE_DETECTION=false

# OnlyOffice
ONLYOFFICE_JWT_SECRET=your-generated-secret
NEXT_PUBLIC_ONLYOFFICE_SERVER_URL=http://192.168.x.x:80
NEXT_PUBLIC_APP_URL=http://192.168.x.x:3000

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx

# Internal secrets (self-generated, must match Convex Dashboard for the two Convex-shared ones)
CRON_SECRET=your-generated-secret
INTERNAL_SECRET=your-generated-secret
INTERNAL_API_SECRET=your-generated-secret

# Summarizer / ML microservice (optional — see section 8)
SUMMARIZER_API_URL=https://your-ml-service.tld
SUMMARIZER_CALLBACK_SECRET=your-generated-secret

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-16-char-app-password
NOTIFICATION_EMAIL_FROM=no-reply@your-domain.tld
```

And in the **Convex Dashboard** (Settings → Environment Variables), set these four separately:
```
CLERK_JWT_ISSUER_DOMAIN=https://xxxxxxxx.clerk.accounts.dev
INTERNAL_SECRET=<same value as .env.local>
INTERNAL_API_SECRET=<same value as .env.local>
SUMMARIZER_CALLBACK_SECRET=<same value as .env.local>
```

---

## 🏃 Running the Project

1. **Clone the repository:**
   ```bash
   git clone https://github.com/auriorajaa/paperspace.git
   cd paperspace
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Start Convex** (this generates/updates your Convex-related `.env.local` values and keeps your backend functions synced):
   ```bash
   npx convex dev
   ```
   Leave this running in its own terminal tab.
4. **Fill in the rest of `.env.local`** using the template above and the per-service instructions.
5. **Start OnlyOffice** using the Docker command in [section 5](#5-onlyoffice-document-server-docker), in its own terminal/machine.
6. **Run the development server** (in a third terminal):
   ```bash
   npm run dev
   ```
7. Open [http://localhost:3000](http://localhost:3000) (or whatever `NEXT_PUBLIC_APP_URL` you configured) in your browser.

## 🚢 Deploying to Production

- **Frontend/API**: deploy the Next.js app to Vercel (or any Node-compatible host). Set all the `.env.local` variables above as Vercel Environment Variables instead.
- **Backend**: run `npx convex deploy` to push to your production Convex deployment, and set the four backend-only variables in that deployment's dashboard settings.
- **OnlyOffice**: for production use, run the Docker container on a proper server (not a personal laptop) with a stable domain and HTTPS — e.g. behind Nginx + Let's Encrypt, or a persistent Cloudflare Tunnel. A restart on the host machine will otherwise take the editor offline for every user.
- Rotate `CLERK_SECRET_KEY`, `GOOGLE_CLIENT_SECRET`, `BLOB_READ_WRITE_TOKEN`, and the self-generated internal secrets to **new, production-only values** — do not reuse development secrets in production.

## 🩺 Troubleshooting

| Symptom | Likely cause |
|---|---|
| Editor doesn't load, blank iframe | Check browser console for blocked `Analytics.js` (common in Brave / strict ad-blockers). Also verify `NEXT_PUBLIC_ONLYOFFICE_SERVER_URL` is reachable from the browser, and `NEXT_PUBLIC_APP_URL` is reachable *from* the OnlyOffice server (for its save callback). |
| Documents don't save / editor keeps re-initializing | `ONLYOFFICE_JWT_SECRET` mismatch between `.env.local` and the Docker container's `JWT_SECRET`. |
| Google Forms responses never turn into documents | Check `CRON_SECRET` is set and the polling route isn't returning an auth error; check Convex logs for the polling function. |
| Summarization never completes, no error shown | `SUMMARIZER_CALLBACK_SECRET` missing or mismatched in the **Convex Dashboard** (not just `.env.local`) — this fails silently. |
| File uploads suddenly fail with an auth/permission error | `BLOB_READ_WRITE_TOKEN` may have been invalidated/rotated by Vercel — regenerate it. |
| Sign-in works but Convex queries return unauthenticated | `CLERK_JWT_ISSUER_DOMAIN` not set (or mismatched) in the Convex Dashboard, or the Clerk JWT template for Convex wasn't created. |

## 📜 License

This project is proprietary but you can fork it for yourself.

## 📬 Contact

For questions about this handover, the original architecture, or anything not covered above, reach out to:

**Aurio Hendrianoko Rajaa** — mr.auriorajaa@gmail.com