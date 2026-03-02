import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Clack",
  description: "How Clack collects, uses, and protects your data.",
};

export default function PrivacyPage() {
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
              className="text-sm transition-colors duration-200 hover:opacity-80"
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
        <h1 className="text-4xl font-bold mb-4" style={{ color: "#FFFFFF" }}>Privacy Policy</h1>
        <p className="text-base leading-relaxed mb-12" style={{ color: "#A1A1AA" }}>
          Clack ("we", "our", or "us") is committed to protecting your privacy. This policy explains
          what information we collect, how we use it, and your rights regarding that information.
        </p>

        <div className="space-y-10">
          <Section title="1. Information We Collect">
            <P>We collect the following categories of information:</P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li><strong style={{ color: "#E4E4E7" }}>Account information:</strong> Your email address and password when you create an account.</Li>
              <Li><strong style={{ color: "#E4E4E7" }}>Social media data:</strong> When you connect a social platform (e.g. Instagram, TikTok), we access publicly available account data including posts, engagement metrics, follower counts, and profile information. We store OAuth access tokens so we can read this data on your behalf.</Li>
              <Li><strong style={{ color: "#E4E4E7" }}>Usage data:</strong> Information about how you interact with Clack, including pages visited, features used, and AI conversations.</Li>
              <Li><strong style={{ color: "#E4E4E7" }}>Communications:</strong> Messages you send to our support team.</Li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <P>We use your information to:</P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li>Provide, operate, and improve the Clack service.</Li>
              <Li>Analyze your social media performance using AI to generate insights, marketing plans, and recommendations.</Li>
              <Li>Respond to your questions and support requests.</Li>
              <Li>Send transactional emails (e.g. account confirmations, sync notifications).</Li>
              <Li>Comply with legal obligations and enforce our Terms of Service.</Li>
            </ul>
            <P className="mt-4">
              We do <strong style={{ color: "#E4E4E7" }}>not</strong> sell your personal data to third parties.
              We do not use your social media content to train AI models without your explicit consent.
            </P>
          </Section>

          <Section title="3. Third-Party Services">
            <P>Clack uses the following third-party services to operate:</P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li><strong style={{ color: "#E4E4E7" }}>Supabase</strong> — Database and authentication. Your data is stored in Supabase's infrastructure. See <ExternalLink href="https://supabase.com/privacy">supabase.com/privacy</ExternalLink>.</Li>
              <Li><strong style={{ color: "#E4E4E7" }}>Anthropic</strong> — AI analysis. Content from your social accounts may be sent to Anthropic's API to generate insights. See <ExternalLink href="https://www.anthropic.com/privacy">anthropic.com/privacy</ExternalLink>.</Li>
              <Li><strong style={{ color: "#E4E4E7" }}>Meta (Facebook/Instagram)</strong> — OAuth integration to access your Instagram Business account data via the Instagram Graph API.</Li>
              <Li><strong style={{ color: "#E4E4E7" }}>TikTok</strong> — OAuth integration to access your TikTok creator account data.</Li>
              <Li><strong style={{ color: "#E4E4E7" }}>Vercel</strong> — Hosting and edge network. See <ExternalLink href="https://vercel.com/legal/privacy-policy">vercel.com/legal/privacy-policy</ExternalLink>.</Li>
            </ul>
          </Section>

          <Section title="4. Data Retention">
            <P>
              We retain your account data for as long as your account is active. Social media metrics
              and post data are retained to provide historical analysis. If you disconnect a platform,
              we stop syncing new data; existing data is retained unless you request deletion.
            </P>
            <P className="mt-3">
              You may request deletion of all your data at any time by contacting us at{" "}
              <a href="mailto:cyntaxai@gmail.com" style={{ color: "#A78BFA" }}>cyntaxai@gmail.com</a>.
              We will process your request within 30 days.
            </P>
          </Section>

          <Section title="5. Data Security">
            <P>
              We use industry-standard measures to protect your data, including:
            </P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li>TLS encryption for all data in transit.</Li>
              <Li>OAuth access tokens are encrypted at rest using AES-256-GCM.</Li>
              <Li>Row-level security policies ensure each user can only access their own data.</Li>
              <Li>We do not store your social platform passwords.</Li>
            </ul>
          </Section>

          <Section title="6. Your Rights">
            <P>Depending on your jurisdiction, you may have the right to:</P>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed" style={{ color: "#A1A1AA" }}>
              <Li>Access the personal data we hold about you.</Li>
              <Li>Correct inaccurate data.</Li>
              <Li>Request deletion of your data ("right to be forgotten").</Li>
              <Li>Object to or restrict certain processing activities.</Li>
              <Li>Data portability — receive your data in a machine-readable format.</Li>
            </ul>
            <P className="mt-4">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:cyntaxai@gmail.com" style={{ color: "#A78BFA" }}>cyntaxai@gmail.com</a>.
            </P>
          </Section>

          <Section title="7. Cookies">
            <P>
              Clack uses essential cookies for authentication (managed by Supabase) and short-lived
              session cookies during OAuth flows. We do not use tracking or advertising cookies.
            </P>
          </Section>

          <Section title="8. Children's Privacy">
            <P>
              Clack is not intended for users under 13 years of age. We do not knowingly collect
              personal information from children under 13. If you believe a child has provided us
              with personal information, please contact us and we will delete it promptly.
            </P>
          </Section>

          <Section title="9. Changes to This Policy">
            <P>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by email or by posting a notice in the app. Continued use of Clack after
              changes take effect constitutes your acceptance of the updated policy.
            </P>
          </Section>

          <Section title="10. Contact Us">
            <P>
              If you have questions about this Privacy Policy or our data practices, contact us at:
            </P>
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
                <a href="mailto:cyntaxai@gmail.com" style={{ color: "#A78BFA" }}>
                  cyntaxai@gmail.com
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
            <Link href="/privacy" className="text-sm" style={{ color: "#A78BFA" }}>Privacy</Link>
            <Link href="/terms" className="text-sm transition-colors duration-200" style={{ color: "#71717A" }}>Terms</Link>
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

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#A78BFA" }}
    >
      {children}
    </a>
  );
}
