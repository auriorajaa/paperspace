# Paperspace

Paperspace is an advanced intelligent document & workflow automation platform built with modern web technologies. It significantly simplifies document generation, template management, and automated form-to-document mapping by providing a seamless, real-time collaboration environment.

## 🚀 Features

- **Advanced Document Templating**: Native support for DOCX, PDF, and XLSX files. Automatically merge data into templates.
- **Form-to-Document Automation**: Seamless integration allowing seamless mapping of form submissions directly onto customized document templates.
- **Embedded Document Editing**: Fully integrated OnlyOffice editor (`@onlyoffice/document-editor-react`) to view and edit documents dynamically directly in the browser without context switching.
- **Real-Time Data Sync**: Powered by Convex to enable real-time backend updates and blazing-fast data syncing across devices.
- **Secure Authentication and Storage**: Complete single sign-on capabilities using Clerk, tightly integrated with scalable blob storage (`@vercel/blob`).
- **Modern, Accessible UI**: A beautiful, responsive interface utilizing Tailwind CSS, Lucide Icons, and heavily inspired by shadcn/ui and Radix UI.
- **PDF & Word Engine**: In-browser document manipulation via specialized engines such as `pdf-lib`, `pdfjs-dist`, `docxtemplater`, and `mammoth`.

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org) (React 19)
- **Backend & Database**: [Convex](https://www.convex.dev/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) / Radix UI
- **Document Processing**: OnlyOffice, PDF.js, docxtemplater, pdf-lib
- **Storage**: Vercel Blob

## 📦 Getting Started

### Prerequisites

- Node.js >= 20
- npm, yarn, pnpm, or bun

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/auriorajaa/paperspace.git
   cd paperspace
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env.local` file in the root directory and add your keys for Clerk Auth, Convex, and Vercel Blob.

4. **Run the development server:**

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🧩 Architecture & Workspace Structure

- `app/` - Next.js App Router (Auth flow, Main workspace UI, API endpoints, webhooks)
- `components/` - Global reusable React components & specialized integrations (OnlyOfficeEditor, previews)
- `contexts/` - Global React contexts (Theme, etc.)
- `convex/` - Convex backend codebase including schema definitions, queries, mutations, and recurring cron jobs.
- `lib/` - Specialized utilities for document generation, placeholder detection, template processing, etc.

## 📜 License

This project is proprietary but you can fork it for yourself.
