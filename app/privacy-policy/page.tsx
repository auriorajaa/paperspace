// app/privacy-policy/page.tsx
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import Link from "next/link";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy Policy",
  description:
    "Learn how Paperspace collects, uses, and protects your personal data.",
  path: "/privacy-policy",
});

const LAST_UPDATED = "June 2025";

const sections = [
  {
    id: "information-we-collect",
    title: "Information We Collect",
    content: [
      {
        subtitle: "Account Information",
        text: "When you create a Paperspace account, we collect basic account identifiers such as your name, email address, and profile picture as provided by your chosen authentication provider. This information is necessary to operate the service.",
      },
      {
        subtitle: "Documents & Content",
        text: "We store documents, templates, collections, and other content that you create or upload ('Your Content'). By uploading or creating content on Paperspace, you acknowledge that such content will be stored on our infrastructure and processed as necessary to deliver the service, including for AI-generated summaries.",
      },
      {
        subtitle: "Usage & Technical Data",
        text: "We automatically collect usage data, log data, device information, IP addresses, browser type, and similar technical identifiers. This data is collected automatically and is necessary for the operation, security, and improvement of Paperspace. Your use of the service constitutes consent to this collection.",
      },
    ],
  },
  {
    id: "how-we-use",
    title: "How We Use Your Information",
    content: [
      {
        subtitle: "Service Operation",
        text: "We use your information exclusively to operate, maintain, and improve Paperspace. This includes authenticating users, storing and retrieving content, processing document operations, and enabling integrations you have explicitly activated.",
      },
      {
        subtitle: "AI Features",
        text: "Document content may be transmitted to third-party AI providers for the sole purpose of generating summaries. Paperspace makes no warranties regarding the accuracy or completeness of AI-generated summaries. You assume full responsibility for any reliance on such summaries. Paperspace is not liable for any loss or damage arising from inaccurate, incomplete, or misleading AI-generated content.",
      },
      {
        subtitle: "Service Improvement",
        text: "We may use aggregated and anonymised usage data to analyse trends and improve the service. We reserve the right to use non-personally-identifiable, aggregated data for any lawful purpose without restriction.",
      },
      {
        subtitle: "Communications",
        text: "We may send transactional and service-related communications to your registered email address. You may not opt out of essential service communications.",
      },
    ],
  },
  {
    id: "data-sharing",
    title: "Data Sharing & Disclosure",
    content: [
      {
        subtitle: "Service Providers",
        text: "We engage third-party service providers including but not limited to Convex (infrastructure), Clerk (authentication), and Vercel (hosting) to operate Paperspace. By using the service, you consent to your data being processed by these providers as necessary. Paperspace is not responsible for the data practices of third-party providers, and you are encouraged to review their respective privacy policies.",
      },
      {
        subtitle: "Organisation Workspaces",
        text: "If you operate within an organisation workspace, documents you share within that workspace are visible to other members of the same organisation. Paperspace is not responsible for how organisation administrators or members access, use, or share documents within the workspace.",
      },
      {
        subtitle: "Legal Disclosure",
        text: "We reserve the right to disclose any information about you without notice if we believe, in our sole discretion, that such disclosure is necessary to: comply with any applicable law, regulation, legal process, or government request; protect the rights, property, or safety of Paperspace, its operators, users, or the public; detect, prevent, or address fraud, security, or technical issues; or enforce these policies.",
      },
      {
        subtitle: "Business Transfers",
        text: "In the event of a merger, acquisition, reorganisation, or sale of assets, your information may be transferred to the acquiring entity without your consent. We will not provide separate notice of such transfers.",
      },
    ],
  },
  {
    id: "data-storage",
    title: "Data Storage & Security",
    content: [
      {
        subtitle: "Infrastructure",
        text: "Your data is stored on third-party cloud infrastructure. While we take reasonable measures to protect your data, Paperspace does not guarantee the security of any information transmitted to or stored on our platform. You use the service at your own risk.",
      },
      {
        subtitle: "No Guarantee of Security",
        text: "No method of transmission over the internet or electronic storage is 100% secure. Paperspace expressly disclaims any representation or warranty that your data will be secure, and shall not be liable for any unauthorised access, breach, or disclosure of your data.",
      },
      {
        subtitle: "Data Retention",
        text: "We retain your data for as long as your account exists and for such additional periods as we deem necessary for legal, operational, or legitimate business purposes. We reserve the right to delete inactive accounts and their associated data without notice after a period of prolonged inactivity.",
      },
    ],
  },
  {
    id: "your-choices",
    title: "Your Choices",
    content: [
      {
        subtitle: "Access & Export",
        text: "You may access and export your documents at any time through the Paperspace interface. We provide no guarantee of data portability in any specific format beyond what is available within the application.",
      },
      {
        subtitle: "Account Deletion",
        text: "You may request deletion of your account by contacting us. Upon deletion, we will make reasonable efforts to remove your personal data, subject to any legal or operational retention requirements. Residual copies may remain in backup systems for a period after deletion.",
      },
      {
        subtitle: "Limitations",
        text: "We reserve the right to reject requests that are unreasonably repetitive, require disproportionate technical effort, risk the privacy of others, or are not required under applicable law.",
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies & Tracking",
    content: [
      {
        subtitle: "Essential Cookies",
        text: "Paperspace uses cookies that are strictly necessary for the service to function, including session management and preference storage. By using Paperspace, you consent to the use of these cookies. You may disable cookies in your browser settings, but doing so may prevent the service from functioning correctly.",
      },
      {
        subtitle: "Third-Party Cookies",
        text: "Our authentication provider may set additional cookies. Paperspace does not control and is not responsible for third-party cookies. Continued use of the service constitutes acceptance of such cookies.",
      },
    ],
  },
  {
    id: "disclaimer",
    title: "Disclaimer of Liability",
    content: [
      {
        subtitle: "No Warranty",
        text: "Paperspace is provided strictly on an 'as is' and 'as available' basis. To the fullest extent permitted by applicable law, Paperspace expressly disclaims all warranties, whether express, implied, statutory, or otherwise, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
      },
      {
        subtitle: "Limitation of Liability",
        text: "In no event shall Paperspace, its operators, developers, affiliates, or agents be liable for any direct, indirect, incidental, special, consequential, punitive, or exemplary damages whatsoever — including but not limited to loss of data, loss of profits, business interruption, or unauthorised access — arising from or in connection with your use of or inability to use the service, even if Paperspace has been advised of the possibility of such damages. Your sole remedy for dissatisfaction with the service is to cease using it.",
      },
    ],
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: [
      {
        subtitle: "Right to Modify",
        text: "Paperspace reserves the right to modify this Privacy Policy at any time and for any reason, without prior notice. Changes are effective immediately upon posting. The 'Last updated' date will be revised accordingly. Your continued use of the service after any modification constitutes your unconditional acceptance of the updated policy. It is your responsibility to review this policy periodically.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    content: [
      {
        subtitle: "Enquiries",
        text: "If you have questions about this Privacy Policy, you may contact us. We will endeavour to respond within a reasonable time, but we do not guarantee any specific response time or resolution.",
      },
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              "linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div
          className="absolute top-[-20%] left-[5%] w-[500px] h-[500px] rounded-full"
          style={{ background: "var(--ambient-glow)", filter: "blur(140px)" }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-5 py-16 sm:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-10 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Paperspace
        </Link>

        <div className="mb-12">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5"
            style={{
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-border)",
              color: "var(--accent-light)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Legal
          </div>
          <h1
            className="text-[2rem] sm:text-[2.6rem] font-bold leading-tight tracking-tight mb-3"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Privacy Policy
          </h1>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
            Last updated: {LAST_UPDATED}
          </p>
          <p
            className="mt-4 text-[15px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            This Privacy Policy governs your use of Paperspace. By using the
            service, you acknowledge that you have read, understood, and agree
            to be bound by this policy in its entirety.
          </p>
        </div>

        <div
          className="rounded-2xl p-5 mb-12"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--text-dim)" }}
          >
            Contents
          </p>
          <ol className="space-y-1.5">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 text-[13px] group"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span
                    className="text-[10px] font-bold tabular-nums w-4 shrink-0"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="group-hover:underline">{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-12">
          {sections.map((section, i) => (
            <section key={section.id} id={section.id}>
              <div className="flex items-center gap-3 mb-6">
                <span
                  className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md"
                  style={{
                    background: "var(--accent-bg)",
                    color: "var(--accent-light)",
                    border: "1px solid var(--accent-border)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2
                  className="text-[1.15rem] font-semibold"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {section.title}
                </h2>
              </div>
              <div className="space-y-5 pl-1">
                {section.content.map((item) => (
                  <div key={item.subtitle}>
                    <h3
                      className="text-[13px] font-semibold mb-1.5"
                      style={{ color: "var(--text)" }}
                    >
                      {item.subtitle}
                    </h3>
                    <p
                      className="text-[13.5px] leading-relaxed"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
              {i < sections.length - 1 && (
                <div
                  className="mt-12 h-px"
                  style={{ background: "var(--border-subtle)" }}
                />
              )}
            </section>
          ))}
        </div>

        <div
          className="mt-16 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p className="text-[12px]" style={{ color: "var(--text-dim)" }}>
            © {new Date().getFullYear()} Paperspace. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/terms-of-service"
              className="text-[12px]"
              style={{ color: "var(--text-muted)" }}
            >
              Terms of Service
            </Link>
            <Link
              href="/"
              className="text-[12px]"
              style={{ color: "var(--text-muted)" }}
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
