import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Clack",
  description: "The terms and conditions governing your use of Clack.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#1C1C1F", color: "#E4E4E7" }}>
      {/* Navbar */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: "rgba(28,28,31,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold" style={{ color: "#FFFFFF" }}>
              Clack
            </Link>
            <Link
              href="/"
              className="text-sm transition-colors duration-200"
              style={{ color: "#71717A" }}
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-sm mb-3" style={{ color: "#71717A" }}>Last updated: March 1, 2026</p>
        <h1 className="text-4xl font-bold mb-4" style={{ color: "#FFFFFF" }}>Terms of Service</h1>
        <p className="text-base leading-relaxed mb-12" style={{ color: "#A1A1AA" }}>
          These Terms of Service ("Terms") govern your access to and use of Clack ("we", "our", "us",
          or the "Service"). By creating an account or using Clack, you agree to these Terms.
          Please read them carefully.
        </p>

        <div className="space-y-10">
          <Section title="1. Acceptance of Terms">
            <P>
              By accessing or using Clack, you confirm that you are at least 13 years old, have the
              legal capacity to enter into these Terms, and agree to be bound by them. If you are
              using Clack on behalf of an organization, you represent that you have the authority
              to bind that organization to these Terms.
            </P>
          </Section>

          <Section title="2. Description of Service">
            <P>
              Clack is an AI-powered social media marketing platform that helps content creators and
              businesses analyze their social media performance, generate marketing strategies, and
              extract viral content. The Service connects to third-party social media platforms
              (including Instagram, TikTok, YouTube, LinkedIn, and X/Twitter) via OAuth to access
              your account data.
            </P>
          </Section>

          <Section title="3. Account Registration">
            <P>You must create an account to use Clack. You agree to:</P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li>Provide accurate and complete registration information.</Li>
              <Li>Keep your login credentials confidential and not share them with others.</Li>
              <Li>Notify us immediately at <a href="mailto:support@clack.app" style={{ color: "#A78BFA" }}>support@clack.app</a> if you suspect unauthorized access to your account.</Li>
              <Li>Be responsible for all activity that occurs under your account.</Li>
            </ul>
          </Section>

          <Section title="4. Connecting Social Media Accounts">
            <P>
              When you connect a social media account, you grant Clack permission to access your
              account data as authorized by the relevant platform's OAuth flow. This includes
              profile information, posts, engagement metrics, and audience data.
            </P>
            <P className="mt-3">You represent and warrant that:</P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li>You own or have the right to connect the social media accounts you link to Clack.</Li>
              <Li>Connecting your accounts does not violate any third-party platform's terms of service.</Li>
              <Li>You will not use Clack to access accounts you are not authorized to access.</Li>
            </ul>
            <P className="mt-4">
              You can revoke access to any connected account at any time from the Accounts page or
              directly through the third-party platform's settings.
            </P>
          </Section>

          <Section title="5. Acceptable Use">
            <P>You agree not to use Clack to:</P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li>Violate any applicable law or regulation.</Li>
              <Li>Access social media accounts or data you are not authorized to access.</Li>
              <Li>Attempt to reverse engineer, decompile, or extract source code from the Service.</Li>
              <Li>Transmit malware, viruses, or other harmful code.</Li>
              <Li>Interfere with or disrupt the integrity or performance of the Service.</Li>
              <Li>Scrape or harvest data from Clack in an automated manner not authorized by us.</Li>
              <Li>Resell or sublicense access to the Service without our written permission.</Li>
            </ul>
          </Section>

          <Section title="6. AI-Generated Content">
            <P>
              Clack uses artificial intelligence to analyze your social media data and generate
              marketing insights, plans, and recommendations. You acknowledge that:
            </P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li>AI-generated content is provided for informational purposes and does not constitute professional marketing, legal, or financial advice.</Li>
              <Li>Results may not always be accurate, complete, or suitable for your specific situation.</Li>
              <Li>You are solely responsible for any decisions made based on AI-generated insights.</Li>
              <Li>Clack does not guarantee specific outcomes such as follower growth or increased engagement.</Li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <P>
              The Clack platform, including its design, code, AI models, and brand assets, is owned
              by Clack and protected by applicable intellectual property laws. These Terms do not
              grant you any rights to our intellectual property except as expressly stated.
            </P>
            <P className="mt-3">
              You retain full ownership of your social media content and data. By connecting your
              accounts, you grant Clack a limited, non-exclusive license to access and process
              your content solely to provide the Service.
            </P>
          </Section>

          <Section title="8. Subscription and Billing">
            <P>
              Clack offers paid subscription plans. Each plan includes a 7-day free trial with no credit card required. The following terms apply:
            </P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li>Your 7-day free trial begins when you create an account. No credit card is required to start.</Li>
              <Li>At the end of the trial, you must add a payment method to continue using the Service.</Li>
              <Li>Subscriptions are billed in advance on a monthly basis.</Li>
              <Li>All fees are non-refundable except as required by applicable law.</Li>
              <Li>We may change pricing with 30 days' advance notice.</Li>
              <Li>Failure to pay may result in suspension or termination of your account.</Li>
            </ul>
          </Section>

          <Section title="9. Termination">
            <P>
              You may close your account at any time from the Settings page or by contacting{" "}
              <a href="mailto:support@clack.app" style={{ color: "#A78BFA" }}>support@clack.app</a>.
            </P>
            <P className="mt-3">
              We reserve the right to suspend or terminate your account without notice if you
              violate these Terms, engage in fraudulent activity, or if we discontinue the Service.
              Upon termination, your right to use Clack ceases immediately.
            </P>
          </Section>

          <Section title="10. Disclaimer of Warranties">
            <P>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
              ERROR-FREE, OR FREE OF VIRUSES. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM
              ALL WARRANTIES INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </P>
          </Section>

          <Section title="11. Limitation of Liability">
            <P>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CLACK AND ITS OFFICERS,
              DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
              SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES — INCLUDING LOSS OF PROFITS, DATA, OR
              GOODWILL — ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF WE HAVE
              BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </P>
            <P className="mt-3">
              OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS SHALL NOT EXCEED THE
              GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM OR
              (B) $100 USD.
            </P>
          </Section>

          <Section title="12. Indemnification">
            <P>
              You agree to indemnify and hold harmless Clack and its officers, directors, employees,
              and agents from any claims, damages, losses, and expenses (including reasonable
              attorneys' fees) arising out of (a) your use of the Service, (b) your violation of
              these Terms, or (c) your violation of any third party's rights.
            </P>
          </Section>

          <Section title="13. Governing Law">
            <P>
              These Terms are governed by the laws of the State of Delaware, United States, without
              regard to conflict of law principles. Any disputes shall be resolved exclusively in
              the state or federal courts located in Delaware.
            </P>
          </Section>

          <Section title="14. Changes to These Terms">
            <P>
              We may update these Terms from time to time. We will notify you of material changes
              by email or by posting a notice in the app at least 14 days before the changes take
              effect. Continued use of Clack after the effective date constitutes your acceptance
              of the updated Terms.
            </P>
          </Section>

          <Section title="15. Contact Us">
            <P>If you have questions about these Terms, contact us at:</P>
            <div
              className="mt-4 p-4 rounded-xl text-sm"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#A1A1AA",
              }}
            >
              <p style={{ color: "#E4E4E7" }} className="font-medium">Clack</p>
              <p className="mt-1">
                Email:{" "}
                <a href="mailto:legal@clack.app" style={{ color: "#A78BFA" }}>
                  legal@clack.app
                </a>
              </p>
            </div>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="py-8 px-4 sm:px-6 border-t mt-16"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold" style={{ color: "#E4E4E7" }}>
            Clack
          </Link>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm transition-colors duration-200" style={{ color: "#71717A" }}>Privacy</Link>
            <Link href="/terms" className="text-sm" style={{ color: "#A78BFA" }}>Terms</Link>
          </div>
        </div>
        <p className="text-center text-sm mt-6" style={{ color: "#71717A" }}>
          © {new Date().getFullYear()} Clack. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-3" style={{ color: "#FFFFFF" }}>{title}</h2>
      <div
        className="w-12 h-px mb-5"
        style={{ background: "rgba(124,92,252,0.4)" }}
      />
      {children}
    </section>
  );
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm leading-relaxed ${className}`} style={{ color: "#A1A1AA" }}>
      {children}
    </p>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 shrink-0" style={{ color: "#7C5CFC" }}>•</span>
      <span>{children}</span>
    </li>
  );
}
