// app/terms-of-service/page.tsx
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/metadata";
import Link from "next/link";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of Service",
  description:
    "Read the terms and conditions governing your use of Paperspace.",
  path: "/terms-of-service",
});

const LAST_UPDATED = "June 2025";

const sections = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    content: [
      {
        subtitle: "Binding Agreement",
        text: "By accessing, browsing, or using Paperspace in any manner, you agree to be bound by these Terms of Service in full. If you do not agree with any part of these Terms, you must immediately stop using the service. Continued use of the service constitutes unconditional acceptance of these Terms.",
      },
      {
        subtitle: "Eligibility",
        text: "You must be at least 13 years of age to use Paperspace. By using the service, you represent and warrant that you meet this requirement. If you are using Paperspace on behalf of an organisation, you represent that you have full authority to bind that organisation, and that the organisation accepts these Terms.",
      },
      {
        subtitle: "Changes to Terms",
        text: "Paperspace reserves the right to modify, update, or replace these Terms at any time and without prior notice. Changes take effect immediately upon posting. It is your sole responsibility to review these Terms periodically. Your continued use of the service following any changes constitutes your unconditional acceptance of the revised Terms.",
      },
    ],
  },
  {
    id: "the-service",
    title: "The Service",
    content: [
      {
        subtitle: "Provided As-Is",
        text: "Paperspace is a document workspace provided strictly on an 'as is' and 'as available' basis. We make no guarantees regarding the availability, reliability, accuracy, or fitness for purpose of any feature or function of the service.",
      },
      {
        subtitle: "Service Modifications",
        text: "Paperspace reserves the right at any time and without notice to: modify, suspend, or discontinue any part or all of the service; introduce or remove features; change pricing (with notice where required by law); impose limits on certain features; or restrict access to parts or all of the service. Paperspace shall not be liable to you or any third party for any modification, suspension, or discontinuation of the service.",
      },
      {
        subtitle: "No Uptime Guarantee",
        text: "We do not warrant that the service will be uninterrupted, timely, secure, or error-free. Downtime, data loss, or service degradation may occur at any time. Paperspace accepts no liability for any loss or inconvenience arising from service unavailability.",
      },
    ],
  },
  {
    id: "your-account",
    title: "Your Account",
    content: [
      {
        subtitle: "Account Responsibility",
        text: "You are solely responsible for all activity that occurs under your account, regardless of whether such activity is authorised by you. Paperspace shall not be liable for any loss or damage arising from unauthorised use of your account.",
      },
      {
        subtitle: "Account Security",
        text: "You are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately of any suspected unauthorised access; however, we are under no obligation to take any specific action in response.",
      },
      {
        subtitle: "Account Suspension",
        text: "Paperspace reserves the right, in its sole discretion and without notice, to suspend or permanently terminate your account for any reason, including but not limited to: violation of these Terms, suspected fraudulent or abusive behaviour, legal requirements, or inactivity. No refund or compensation will be issued upon termination.",
      },
    ],
  },
  {
    id: "your-content",
    title: "Your Content",
    content: [
      {
        subtitle: "Your Responsibility",
        text: "You are solely and exclusively responsible for all documents, files, text, templates, and other content you upload, create, or transmit through Paperspace ('Your Content'). Paperspace does not review, verify, or endorse Your Content and accepts no liability for it.",
      },
      {
        subtitle: "Licence Grant",
        text: "By uploading or creating content on Paperspace, you grant us a worldwide, non-exclusive, royalty-free, sublicensable licence to store, reproduce, process, display, transmit, and modify Your Content solely to the extent necessary to operate and provide the service. This licence survives the termination of your account to the extent required for technical or legal purposes.",
      },
      {
        subtitle: "Content Warranties",
        text: "You represent and warrant that: you own or have all necessary rights to Your Content; Your Content does not infringe any third-party intellectual property, privacy, or other rights; and Your Content complies with all applicable laws. You agree to indemnify and hold Paperspace harmless against any claims arising from Your Content.",
      },
      {
        subtitle: "Content Removal",
        text: "Paperspace reserves the right, without notice or liability, to remove or disable access to any content that we determine, in our sole discretion, violates these Terms or applicable law, or that is otherwise objectionable.",
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    content: [
      {
        subtitle: "Prohibited Activities",
        text: "You may not use Paperspace to: upload or create unlawful, harmful, defamatory, obscene, or infringing content; gain or attempt to gain unauthorised access to our systems or other users' accounts; interfere with, disrupt, or overburden our infrastructure; reverse engineer, decompile, or disassemble any part of the service; resell, sublicense, or commercially exploit the service without written permission; use automated tools or bots to access the service in ways that violate these Terms; or use the service for any purpose that violates applicable laws.",
      },
      {
        subtitle: "Enforcement",
        text: "Paperspace reserves the right to investigate violations and take any action we deem appropriate, including but not limited to suspending or terminating accounts, reporting activity to law enforcement, and seeking legal remedies. We are under no obligation to monitor use of the service.",
      },
    ],
  },
  {
    id: "third-party",
    title: "Third-Party Services",
    content: [
      {
        subtitle: "No Liability for Third Parties",
        text: "Paperspace integrates with third-party services including Google, Clerk, Convex, and ONLYOFFICE. These services are provided by independent parties over whom Paperspace has no control. Paperspace expressly disclaims all liability for the availability, accuracy, security, or performance of any third-party service. Any issues with third-party services are entirely the responsibility of the respective provider.",
      },
      {
        subtitle: "Google Integration",
        text: "By connecting your Google account, you authorise Paperspace to access your Google Forms and related data. Paperspace is not responsible for any consequences arising from this authorisation, including data shared with or by Google.",
      },
      {
        subtitle: "Third-Party Terms",
        text: "Your use of third-party services through Paperspace is also governed by those services' own terms and privacy policies. Paperspace accepts no responsibility for third-party terms or their enforcement.",
      },
    ],
  },
  {
    id: "intellectual-property",
    title: "Intellectual Property",
    content: [
      {
        subtitle: "Our IP",
        text: "All rights, title, and interest in and to Paperspace — including its interface, design, features, functionality, branding, and source code — are and remain the exclusive property of Paperspace and its licensors. Nothing in these Terms grants you any right to use our trademarks, logos, or branding.",
      },
      {
        subtitle: "Feedback",
        text: "Any feedback, suggestions, or ideas you submit regarding Paperspace become the sole property of Paperspace. We may use such feedback for any purpose without compensation or acknowledgement.",
      },
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers & Limitation of Liability",
    content: [
      {
        subtitle: "No Warranty",
        text: "To the maximum extent permitted by applicable law, Paperspace expressly disclaims all warranties of any kind — express, implied, or statutory — including but not limited to warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the service will meet your requirements, be error-free, or that any defects will be corrected.",
      },
      {
        subtitle: "AI Content Disclaimer",
        text: "AI-generated summaries and outputs are provided for informational convenience only. Paperspace makes no representation as to their accuracy, completeness, or reliability. You assume all risk associated with any reliance on AI-generated content. Paperspace is not liable for any decisions made based on AI outputs.",
      },
      {
        subtitle: "Limitation of Liability",
        text: "To the fullest extent permitted by law, Paperspace, its operators, developers, directors, employees, affiliates, and agents shall not be liable for any indirect, incidental, special, consequential, punitive, or exemplary damages — including but not limited to loss of data, loss of profits, loss of revenue, business interruption, or reputational harm — arising from or in any way connected with: your use of or inability to use the service; any content on the service; unauthorised access to or alteration of your data; or any other matter relating to the service. This limitation applies regardless of the form of action and even if Paperspace has been advised of the possibility of such damages.",
      },
      {
        subtitle: "Indemnification",
        text: "You agree to indemnify, defend, and hold harmless Paperspace and its affiliates, operators, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in connection with your use of the service, Your Content, your violation of these Terms, or your violation of any third-party rights.",
      },
    ],
  },
  {
    id: "termination",
    title: "Termination",
    content: [
      {
        subtitle: "By Paperspace",
        text: "Paperspace may terminate or suspend your access to the service immediately, without prior notice or liability, for any reason whatsoever, including if you breach these Terms. Upon termination, your right to use the service ceases immediately.",
      },
      {
        subtitle: "By You",
        text: "You may stop using Paperspace at any time. Deletion of your account can be requested by contacting us; however, we reserve the right to retain certain data as required by law or for legitimate operational purposes.",
      },
      {
        subtitle: "Survival",
        text: "Provisions of these Terms that by their nature should survive termination — including intellectual property rights, disclaimers, limitation of liability, and indemnification — shall remain in full force after termination.",
      },
    ],
  },
  {
    id: "governing-law",
    title: "Governing Law & Disputes",
    content: [
      {
        subtitle: "Jurisdiction",
        text: "These Terms shall be governed by and construed in accordance with the laws of the Republic of Indonesia, without regard to conflict of law provisions. You agree to submit to the exclusive jurisdiction of the courts located in Indonesia for resolution of any disputes.",
      },
      {
        subtitle: "Dispute Resolution",
        text: "Before initiating any legal proceedings, you agree to first contact Paperspace in good faith to attempt to resolve the dispute informally. Paperspace reserves the right to seek injunctive or other equitable relief in any court of competent jurisdiction without prejudice to any other rights.",
      },
    ],
  },
  {
    id: "general",
    title: "General Provisions",
    content: [
      {
        subtitle: "Entire Agreement",
        text: "These Terms, together with our Privacy Policy, constitute the entire agreement between you and Paperspace regarding the service and supersede all prior agreements and understandings.",
      },
      {
        subtitle: "Severability",
        text: "If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.",
      },
      {
        subtitle: "No Waiver",
        text: "Failure by Paperspace to enforce any provision of these Terms shall not constitute a waiver of our right to enforce that provision in the future.",
      },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    content: [
      {
        subtitle: "Enquiries",
        text: "If you have questions about these Terms, you may contact us. We will endeavour to respond within a reasonable time, but we do not guarantee any specific response time or outcome.",
      },
    ],
  },
];

export default function TermsOfServicePage() {
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
          className="absolute top-[-20%] right-[5%] w-[500px] h-[500px] rounded-full"
          style={{
            background: "rgba(139,92,246,0.045)",
            filter: "blur(140px)",
          }}
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
              background: "rgba(167,139,250,0.1)",
              border: "1px solid rgba(167,139,250,0.2)",
              color: "#a78bfa",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Legal
          </div>
          <h1
            className="text-[2rem] sm:text-[2.6rem] font-bold leading-tight tracking-tight mb-3"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Terms of Service
          </h1>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
            Last updated: {LAST_UPDATED}
          </p>
          <p
            className="mt-4 text-[15px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Please read these Terms of Service carefully. By accessing or using
            Paperspace in any way, you agree to be fully bound by these terms.
            If you do not agree, do not use the service.
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
                    background: "rgba(167,139,250,0.1)",
                    color: "#a78bfa",
                    border: "1px solid rgba(167,139,250,0.2)",
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
              href="/privacy-policy"
              className="text-[12px]"
              style={{ color: "var(--text-muted)" }}
            >
              Privacy Policy
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
