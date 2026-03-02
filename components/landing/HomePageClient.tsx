"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { PlatformIcon } from "@/components/social/PlatformIcon";
import type { SocialPlatform } from "@/lib/types/social";

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useCounter(target: number, duration: number, started: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!started) return;
    let startTime: number | null = null;
    let raf: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, target, duration]);
  return value;
}

function useTyping(text: string, started: boolean, delayMs = 0): string {
  const [displayed, setDisplayed] = useState("");
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => setActive(true), delayMs);
    return () => clearTimeout(t);
  }, [started, delayMs]);
  useEffect(() => {
    if (!active) return;
    setDisplayed("");
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [active, text]);
  return displayed;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "youtube", "linkedin", "twitter", "facebook"];

const GLASS_SHADOW =
  "inset 0 1px 0 0 rgba(255,255,255,0.28), inset 0 -1px 0 0 rgba(0,0,0,0.04), inset 1px 0 0 0 rgba(255,255,255,0.16), inset -1px 0 0 0 rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.5)";

const INNER_SHADOW =
  "inset 0 1px 0 0 rgba(255,255,255,0.10), inset 1px 0 0 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.3)";

// Match exactly what the real dashboard cards look like
const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
  boxShadow: INNER_SHADOW,
};

const AI_MESSAGE =
  "Based on your top clips, post more behind-the-scenes content. Your audience engages 2.3x more with those. Best time: Tuesday 7pm.";

function fmtK(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toLocaleString();
}

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
const stagger = { animate: { transition: { staggerChildren: 0.1 } } };

// ── Waitlist Form ──────────────────────────────────────────────────────────────

function WaitlistForm({ source = "homepage", size = "md" }: { source?: string; size?: "md" | "lg" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "loading") return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong");
        return;
      }
      setStatus(data.message === "already_on_list" ? "duplicate" : "success");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Check your connection.");
    }
  };

  if (status === "success" || status === "duplicate") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-5 rounded-xl ${size === "lg" ? "py-4 text-base" : "py-3 text-sm"}`}
        style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#6EE7B7" }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {status === "duplicate" ? "You're already on the list." : "You're on the list. We'll be in touch."}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full max-w-sm">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        disabled={status === "loading"}
        className={`flex-1 min-w-0 rounded-xl outline-none transition-all ${size === "lg" ? "px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base" : "px-4 py-3 text-sm"}`}
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#E8E8F0" }}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className={`shrink-0 font-semibold rounded-xl transition-all ${size === "lg" ? "px-6 py-3 sm:py-4 text-base" : "px-5 py-3 text-sm"}`}
        style={{ background: "#fff", color: "#000" }}
      >
        {status === "loading" ? "..." : "Join waitlist"}
      </button>
      {status === "error" && (
        <span className="text-xs text-red-400 sm:ml-1">{errorMsg ?? "Try again"}</span>
      )}
    </form>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function HomePageClient() {
  const [navOpen, setNavOpen] = useState(false);
  const mockRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);

  // amount:0.55 + rootMargin means the mock must be well into the viewport before firing
  const mockInView = useInView(mockRef, { once: true, amount: 0.55 });
  const howItWorksInView = useInView(howItWorksRef, { once: true, amount: 0.2 });
  const featuresInView = useInView(featuresRef, { once: true, amount: 0.1 });
  const pricingInView = useInView(pricingRef, { once: true, amount: 0.2 });

  const views = useCounter(124200, 1400, mockInView);
  const engagements = useCounter(3847, 1200, mockInView);
  const virality = useCounter(84, 1100, mockInView);
  const typedMessage = useTyping(AI_MESSAGE, mockInView, 1000);

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>

      {/* ── Navbar ── */}
      <nav
        className="sticky top-0 z-50"
        style={{
          background: "rgba(10,10,10,0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link href="/" className="text-xl font-bold" style={{ color: "#FFFFFF" }}>
              Clack
            </Link>
            <div className="hidden md:flex items-center gap-8">
              {[
                { label: "Features", href: "#features" },
                { label: "How it Works", href: "#how-it-works" },
                { label: "Pricing", href: "#pricing" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ color: "#71717A" }}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <a
                href="#waitlist"
                className="hidden md:inline-flex px-4 py-2 text-sm font-semibold rounded-xl transition-all"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#E8E8F0",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.11)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.07)"; }}
              >
                Join Waitlist
              </a>
              <button
                type="button"
                aria-label="Toggle menu"
                onClick={() => setNavOpen((o) => !o)}
                className="md:hidden p-2 -mr-2 rounded-xl transition-colors"
                style={{ color: "#E8E8F0" }}
              >
                {navOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {/* Mobile menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-200 ease-out ${
              navOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
            }`}
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="py-3 flex flex-col gap-1">
              {[
                { label: "Features", href: "#features" },
                { label: "How it Works", href: "#how-it-works" },
                { label: "Pricing", href: "#pricing" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setNavOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
                  style={{ color: "#9898B0" }}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#waitlist"
                onClick={() => setNavOpen(false)}
                className="mx-2 mt-2 py-3 text-center text-sm font-semibold rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#E8E8F0",
                }}
              >
                Join Waitlist
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col justify-start pt-12 sm:pt-20 lg:pt-24 pb-8 sm:pb-10 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2 pointer-events-none"
          style={{
            width: 900,
            height: 480,
            background: "radial-gradient(ellipse at 50% 0%, rgba(124,92,252,0.08) 0%, transparent 65%)",
            filter: "blur(40px)",
          }}
        />
        <motion.div
          className="max-w-4xl mx-auto text-center relative z-10"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 sm:mb-8"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#71717A",
              animation: "pill-pulse 2s ease-in-out infinite",
            }}
            variants={fadeUp}
            transition={{ duration: 0.4 }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: "#10B981",
                animation: "dot-flash 2s ease-in-out infinite",
              }}
            />
            Now in private beta
          </motion.div>

          <motion.h1
            className="text-4xl min-[480px]:text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.1] sm:leading-none"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
          >
            <span className="bg-gradient-to-r from-white via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
              Know exactly what
            </span>
            <br />
            <span className="text-white">to post next</span>
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mt-4 sm:mt-6 px-1 leading-relaxed"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Connect your socials. Get a complete analysis in 60 seconds.
            Never guess about your content strategy again.
          </motion.p>

          <motion.div
            className="mt-8 sm:mt-10 flex flex-col items-center gap-3 w-full max-w-sm mx-auto px-2 sm:px-0"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <WaitlistForm size="lg" source="hero" />
            <p className="text-xs" style={{ color: "#3F3F46" }}>
              7-day free trial · No credit card required
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Animated Product Mock ── */}
      <section ref={mockRef} className="px-4 sm:px-6 lg:px-8 pb-12 sm:pb-20">
        <motion.div
          className="max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 36 }}
          animate={mockInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Outer glow matching real dashboard bg color */}
          <div
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
            style={{
              width: "80%",
              height: 400,
              background: "radial-gradient(ellipse, rgba(124,92,252,0.07) 0%, transparent 70%)",
              filter: "blur(60px)",
              zIndex: 0,
            }}
          />
          <div
            className="relative overflow-hidden select-none pointer-events-none"
            style={{
              transform: "perspective(1200px) rotateX(2deg)",
              transformOrigin: "center top",
              // Match the exact dark background of the real dashboard
              background: "#0A0A0A",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 20,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.10)",
              maxHeight: "min(560px, 85vh)",
              zIndex: 1,
            }}
          >
            {/* Window chrome */}
            <div
              className="flex items-center px-3 sm:px-4 h-9 sm:h-10 shrink-0"
              style={{
                background: "rgba(12,12,20,0.75)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex gap-1.5">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ background: "#FF5F56" }} />
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ background: "#FFBD2E" }} />
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full" style={{ background: "#27C93F" }} />
              </div>
              <span className="flex-1 text-center text-[10px] sm:text-xs truncate mx-2" style={{ color: "#3F3F46" }}>
                app.clack.ai — Dashboard
              </span>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
                style={{ background: "rgba(255,255,255,0.08)", color: "#9898B0" }}
              >
                T
              </div>
            </div>

            <div className="flex flex-col lg:flex-row" style={{ minHeight: 400 }}>
              {/* Sidebar — matches the real dashboard sidebar exactly */}
              <div
                className="w-14 shrink-0 hidden sm:flex flex-col py-4 px-2 gap-0.5"
                style={{
                  background: "rgba(12,12,20,0.75)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  borderRight: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {[
                  { active: true, icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
                  { active: false, icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
                  { active: false, icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
                  { active: false, icon: "M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" },
                  { active: false, dot: true, icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
                ].map((nav, i) => (
                  <div
                    key={i}
                    className="relative w-10 h-10 rounded-xl flex items-center justify-center mx-auto"
                    style={{
                      background: nav.active ? "rgba(255,255,255,0.10)" : "transparent",
                      color: nav.active ? "#E8E8F0" : "#6B6B80",
                    }}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={nav.icon} />
                    </svg>
                    {nav.dot && (
                      <span
                        className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full"
                        style={{ background: "#7C5CFC" }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0 p-3 sm:p-4 overflow-hidden">
                {/* Header */}
                <div className="mb-2 sm:mb-3">
                  <p className="text-xs sm:text-sm font-semibold" style={{ color: "#E8E8F0" }}>Good afternoon</p>
                  <p className="text-[10px] sm:text-xs" style={{ color: "#6B6B80" }}>Here&apos;s your overview for today.</p>
                </div>

                {/* Stats row — matches real glass cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                  {[
                    { val: fmtK(views), label: "Total Views", badge: "+18%", bc: "#81C784", bg: "rgba(129,199,132,0.08)" },
                    { val: fmtK(engagements), label: "Engagements", badge: "+23%", bc: "#81C784", bg: "rgba(129,199,132,0.08)" },
                    { val: "12", label: "Clips Created", badge: "This week", bc: "#9898B0", bg: "rgba(152,152,176,0.08)" },
                    { val: (virality / 10).toFixed(1), label: "Avg Virality", badge: "Score", bc: "#FFB74D", bg: "rgba(255,183,77,0.08)" },
                  ].map((s) => (
                    <div key={s.label} className="p-2 sm:p-3" style={CARD}>
                      <div className="text-sm sm:text-base font-bold" style={{ color: "#E8E8F0" }}>{s.val}</div>
                      <div className="text-[9px] sm:text-[10px] mt-0.5" style={{ color: "#9898B0" }}>{s.label}</div>
                      <span
                        className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ color: s.bc, background: s.bg }}
                      >
                        {s.badge}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Chart + right panel */}
                <div className="flex flex-col md:flex-row gap-2 sm:gap-3 flex-1 min-h-0">
                  {/* Chart — matches real performance card */}
                  <div className="flex-[3] min-h-[140px] md:min-h-0 p-3 sm:p-4 flex flex-col" style={CARD}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold" style={{ color: "#E8E8F0" }}>Performance</span>
                      <div
                        className="flex gap-0.5 p-0.5 rounded-lg"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        <span className="px-2 py-0.5 text-[10px] rounded-md" style={{ background: "#7C5CFC", color: "#fff" }}>7D</span>
                        <span className="px-2 py-0.5 text-[10px] rounded-md" style={{ color: "#6B6B80" }}>30D</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <svg viewBox="0 0 400 170" className="w-full h-full" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="mockAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(124,92,252,0.20)" />
                            <stop offset="100%" stopColor="rgba(124,92,252,0)" />
                          </linearGradient>
                        </defs>
                        {[42, 85, 128].map((y) => (
                          <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                        ))}
                        <motion.path
                          d="M0,155 C50,148 100,132 150,110 C200,88 240,68 280,52 C320,38 360,24 400,14 L400,170 L0,170 Z"
                          fill="url(#mockAreaGrad)"
                          initial={{ opacity: 0 }}
                          animate={mockInView ? { opacity: 1 } : {}}
                          transition={{ duration: 0.5, delay: 1.9 }}
                        />
                        <motion.path
                          d="M0,155 C50,148 100,132 150,110 C200,88 240,68 280,52 C320,38 360,24 400,14"
                          fill="none"
                          stroke="#7C5CFC"
                          strokeWidth="2"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={mockInView ? { pathLength: 1, opacity: 1 } : {}}
                          transition={{ duration: 1.6, ease: "easeOut", delay: 0.4 }}
                        />
                        <motion.circle cx="400" cy="14" r="5" fill="rgba(12,12,20,0.9)" stroke="#7C5CFC" strokeWidth="2"
                          initial={{ opacity: 0 }}
                          animate={mockInView ? { opacity: 1 } : {}}
                          transition={{ duration: 0.3, delay: 2.1 }}
                        />
                        <motion.circle cx="400" cy="14" r="2.5" fill="#7C5CFC"
                          initial={{ opacity: 0 }}
                          animate={mockInView ? { opacity: 1 } : {}}
                          transition={{ duration: 0.3, delay: 2.1 }}
                        />
                      </svg>
                    </div>
                    <div className="flex justify-between mt-2">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                        <span key={d} className="text-[10px]" style={{ color: "#6B6B80" }}>{d}</span>
                      ))}
                    </div>
                  </div>

                  {/* Right: Top Content + AI panel */}
                  <div className="flex-[2] min-h-[180px] md:min-h-0 flex flex-col gap-2 sm:gap-3 shrink-0 md:shrink">
                    <div className="flex-1 p-3 overflow-hidden" style={CARD}>
                      <div className="text-xs font-semibold mb-2" style={{ color: "#E8E8F0" }}>Top Content</div>
                      {[
                        { bg: "rgba(124,92,252,0.2)", title: "How I scaled to 100K", views: "12.4K" },
                        { bg: "rgba(59,130,246,0.2)", title: "Secret to viral hooks", views: "8.7K" },
                        { bg: "rgba(245,158,11,0.2)", title: "Day in my life", views: "6.2K" },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 py-1.5"
                          style={{ borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                        >
                          <div className="w-7 h-7 rounded-lg shrink-0" style={{ background: item.bg, border: "1px solid rgba(255,255,255,0.08)" }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] truncate" style={{ color: "#9898B0" }}>{item.title}</div>
                            <div className="text-[10px]" style={{ color: "#81C784" }}>{item.views} views</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI Strategist panel */}
                    <div
                      className="flex-1 p-3 overflow-hidden"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(124,92,252,0.20)",
                        borderTop: "2px solid rgba(124,92,252,0.5)",
                        borderRadius: "16px",
                        boxShadow: INNER_SHADOW,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: "#7C5CFC", boxShadow: "0 0 8px rgba(124,92,252,0.5)" }}
                        >
                          <span style={{ color: "#fff", fontSize: "8px", fontWeight: 700 }}>✦</span>
                        </div>
                        <span className="text-[11px] font-medium" style={{ color: "#9898B0" }}>AI Strategist</span>
                      </div>
                      <div className="text-[11px] leading-relaxed" style={{ color: "#9898B0" }}>
                        {typedMessage}
                        <motion.span
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ duration: 0.7, repeat: Infinity }}
                          style={{
                            display: "inline-block",
                            width: "1px",
                            height: "11px",
                            background: "#7C5CFC",
                            marginLeft: "1px",
                            verticalAlign: "middle",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom fade */}
            <div
              className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none z-10"
              style={{ background: "linear-gradient(to top, rgba(10,10,10,0.98), transparent)" }}
            />
          </div>
        </motion.div>
      </section>

      {/* ── Platform logos carousel ── */}
      <section
        className="py-8 sm:py-12 px-4 overflow-hidden"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <p className="text-center text-xs uppercase tracking-widest mb-6 sm:mb-8" style={{ color: "#3F3F46" }}>
          Works with
        </p>
        <div className="flex justify-center px-4">
          <div
            className="relative w-full max-w-[280px] overflow-hidden"
            style={{
              maskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
            }}
          >
            <div
              className="flex items-center gap-8 w-max"
              style={{
                animation: "platform-carousel 25s linear infinite",
              }}
            >
              {/* Duplicate sets for seamless loop */}
              {[1, 2].map((set) => (
                <div key={set} className="flex items-center gap-8 shrink-0">
                  {PLATFORMS.map((platform) => (
                    <PlatformIcon key={`${set}-${platform}`} platform={platform} className="w-7 h-7 sm:w-8 sm:h-8 shrink-0" color="#FFFFFF" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it Works — timeline layout ── */}
      <section id="how-it-works" ref={howItWorksRef} className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="text-center mb-12 sm:mb-16 md:mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3F3F46" }}>The process</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: "#E4E4E7" }}>Three steps to clarity</h2>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {[
            {
              step: "01",
              title: "Connect your accounts",
              desc: "Link Instagram, TikTok, YouTube and more in one click. We pull every post, video, metric, and audience signal — automatically synced.",
              accent: "#7C5CFC",
              visual: (
                <div className="flex items-center gap-3 flex-wrap">
                  {PLATFORMS.map((p, i) => (
                    <motion.div
                      key={p}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={howItWorksInView ? { opacity: 1, scale: 1 } : {}}
                      transition={{ delay: 0.3 + i * 0.07, duration: 0.3 }}
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <PlatformIcon platform={p} className="w-5 h-5" color="#9898B0" />
                    </motion.div>
                  ))}
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={howItWorksInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.9, type: "spring" }}
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(129,199,132,0.12)", border: "1px solid rgba(129,199,132,0.3)" }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="#81C784" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                </div>
              ),
            },
            {
              step: "02",
              title: "Clack analyzes everything",
              desc: "Clack reads your entire content history — every post, engagement pattern, audience trend. It surfaces what's working, what isn't, and exactly why.",
              accent: "#06B6D4",
              visual: (
                <div className="space-y-2">
                  {[
                    { label: "Content quality", pct: 78, color: "#7C5CFC" },
                    { label: "Audience match", pct: 91, color: "#06B6D4" },
                    { label: "Posting cadence", pct: 54, color: "#FFB74D" },
                  ].map((bar, i) => (
                    <div key={bar.label}>
                      <div className="flex justify-between text-xs mb-1" style={{ color: "#9898B0" }}>
                        <span>{bar.label}</span>
                        <span>{bar.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                        <motion.div
                          className="h-1.5 rounded-full"
                          style={{ background: bar.color }}
                          initial={{ width: 0 }}
                          animate={howItWorksInView ? { width: `${bar.pct}%` } : {}}
                          transition={{ duration: 0.8, delay: 0.3 + i * 0.15, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              step: "03",
              title: "Execute with precision",
              desc: "Get a personalized weekly content plan, viral moment extraction from your videos, and an AI strategist available 24/7 that knows your brand inside out.",
              accent: "#10B981",
              visual: (
                <div
                  className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#7C5CFC" }}>
                      <span style={{ fontSize: "8px", color: "#fff", fontWeight: 700 }}>✦</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "#9898B0" }}>Your plan for this week</span>
                  </div>
                  {[
                    { day: "Mon", type: "Reel", topic: "Behind-the-scenes setup" },
                    { day: "Wed", type: "Story", topic: "Audience Q&A" },
                    { day: "Fri", type: "Reel", topic: "Tutorial: top tip" },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={howItWorksInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.4 + i * 0.12 }}
                      className="flex items-center gap-2 py-1.5"
                      style={{ borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                    >
                      <span className="text-[11px] font-medium w-8 shrink-0" style={{ color: "#6B6B80" }}>{item.day}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: "rgba(124,92,252,0.12)", color: "#A78BFA" }}
                      >
                        {item.type}
                      </span>
                      <span className="text-[11px] truncate" style={{ color: "#9898B0" }}>{item.topic}</span>
                    </motion.div>
                  ))}
                </div>
              ),
            },
          ].map((item, i) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 32 }}
              animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.18 }}
              className={`flex flex-col md:flex-row gap-6 md:gap-8 items-start mb-12 md:mb-16 last:mb-0 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}
            >
              {/* Text side */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-4">
                  <span
                    className="text-xs font-bold tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: `${item.accent}14`, border: `1px solid ${item.accent}30`, color: item.accent }}
                  >
                    {item.step}
                  </span>
                  <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${item.accent}30, transparent)` }} />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3" style={{ color: "#E4E4E7" }}>{item.title}</h3>
                <p className="text-sm sm:text-base leading-relaxed" style={{ color: "#6B6B80" }}>{item.desc}</p>
              </div>

              {/* Visual side */}
              <div
                className="flex-1 w-full min-w-0 p-4 sm:p-5 rounded-2xl"
                style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", boxShadow: GLASS_SHADOW }}
              >
                {item.visual}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features — bento grid ── */}
      <section
        id="features"
        ref={featuresRef}
        className="py-24 px-4 sm:px-6 lg:px-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={featuresInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3F3F46" }}>What you get</p>
          <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: "#E4E4E7" }}>Everything in one place</h2>
        </motion.div>

        {/* Bento grid — different sizes for visual variety */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-6 gap-4">

          {/* AI Brain — large, spans 4 cols */}
          <motion.div
            className="sm:col-span-4 p-7 rounded-2xl flex flex-col justify-between min-h-[200px]"
            style={{ border: "1px solid rgba(124,92,252,0.25)", background: "rgba(124,92,252,0.04)", boxShadow: "0 0 40px rgba(124,92,252,0.06), inset 0 1px 0 rgba(255,255,255,0.08)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-start justify-between">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(124,92,252,0.15)", border: "1px solid rgba(124,92,252,0.3)", color: "#7C5CFC" }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(124,92,252,0.12)", color: "#A78BFA", border: "1px solid rgba(124,92,252,0.2)" }}>
                Core
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "#E4E4E7" }}>AI Marketing Brain</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#6B6B80" }}>
                Analyzes your entire social presence across every platform. Understand what works, what doesn&apos;t, and exactly what to do next.
              </p>
            </div>
          </motion.div>

          {/* Virality Scoring — small, 2 cols */}
          <motion.div
            className="sm:col-span-2 p-6 rounded-2xl flex flex-col justify-between min-h-[200px]"
            style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: GLASS_SHADOW }}
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.07 }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: "#E4E4E7" }}>Virality Scoring</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#6B6B80" }}>Every clip scored 1–10 before you publish.</p>
            </div>
          </motion.div>

          {/* Viral Clips — 2 cols */}
          <motion.div
            className="sm:col-span-2 p-6 rounded-2xl flex flex-col justify-between min-h-[180px]"
            style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: GLASS_SHADOW }}
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.14 }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: "#E4E4E7" }}>Viral Clip Extraction</h3>
              <p className="text-sm" style={{ color: "#6B6B80" }}>AI finds the best moments in your videos automatically.</p>
            </div>
          </motion.div>

          {/* Content Plans — 2 cols */}
          <motion.div
            className="sm:col-span-2 p-6 rounded-2xl flex flex-col justify-between min-h-[180px]"
            style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: GLASS_SHADOW }}
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.21 }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.25)", color: "#06B6D4" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: "#E4E4E7" }}>Weekly Content Plans</h3>
              <p className="text-sm" style={{ color: "#6B6B80" }}>Data-backed plans with optimal posting times.</p>
            </div>
          </motion.div>

          {/* AI Chat — wide, 4 cols */}
          <motion.div
            className="sm:col-span-4 p-6 rounded-2xl"
            style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: GLASS_SHADOW }}
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.28 }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)", color: "#A78BFA" }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold mb-1" style={{ color: "#E4E4E7" }}>AI Strategist Chat</h3>
                <p className="text-sm" style={{ color: "#6B6B80" }}>
                  Ask anything about your marketing. Instant answers about content, audience, and next moves — 24/7.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Multi-Platform — 2 cols */}
          <motion.div
            className="sm:col-span-2 p-6 rounded-2xl flex flex-col justify-between min-h-[140px]"
            style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: GLASS_SHADOW }}
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            <div className="flex gap-1.5 flex-wrap mb-3">
              {(["instagram", "tiktok", "youtube"] as SocialPlatform[]).map((p) => (
                <div key={p} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <PlatformIcon platform={p} className="w-4 h-4" color="#9898B0" />
                </div>
              ))}
              <span className="text-xs self-center" style={{ color: "#6B6B80" }}>+3</span>
            </div>
            <div>
              <h3 className="text-base font-semibold mb-1" style={{ color: "#E4E4E7" }}>Multi-Platform</h3>
              <p className="text-sm" style={{ color: "#6B6B80" }}>One dashboard, all your accounts.</p>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── Pricing ── */}
      <section
        id="pricing"
        ref={pricingRef}
        className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
      >
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={pricingInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "#3F3F46" }}>Simple pricing</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold px-2" style={{ color: "#E4E4E7" }}>Start free, scale when ready</h2>
        </motion.div>

        <p className="text-center text-sm mb-10 sm:mb-14 px-2" style={{ color: "#52525B" }}>
          Every plan includes a <span style={{ color: "#9898B0" }}>7-day free trial</span> — no credit card required.
        </p>

        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {[
            {
              name: "Starter",
              price: "$19",
              features: ["1 platform", "20 AI messages / month", "Basic performance insights", "Weekly summary report"],
              featured: false,
            },
            {
              name: "Pro",
              price: "$49",
              features: ["All platforms", "Unlimited AI messages", "Weekly content plans", "Virality scoring", "AI strategist chat", "Viral clip extraction"],
              featured: true,
            },
            {
              name: "Business",
              price: "$149",
              features: ["Unlimited brands", "White label options", "API access", "Dedicated support", "Priority processing"],
              featured: false,
            },
          ].map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 24 }}
              animate={pricingInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className={tier.featured ? "sm:-mt-4 sm:mb-4 order-first sm:order-none" : ""}
            >
              {/* Gradient border wrapper for Pro */}
              {tier.featured ? (
                <div
                  className="p-px rounded-2xl h-full"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(124,92,252,0.3), rgba(168,85,247,0.6))",
                    boxShadow: "0 0 60px rgba(124,92,252,0.18), 0 0 30px rgba(139,92,246,0.10)",
                  }}
                >
                  <div
                    className="p-4 sm:p-6 h-full flex flex-col rounded-2xl"
                    style={{ background: "rgba(14,14,20,0.98)" }}
                  >
                    <span
                      className="text-xs font-medium px-3 py-1 rounded-full w-fit mb-3 sm:mb-4"
                      style={{ background: "rgba(124,92,252,0.15)", border: "1px solid rgba(124,92,252,0.35)", color: "#A78BFA" }}
                    >
                      Most Popular
                    </span>
                    <h3 className="font-semibold" style={{ color: "#E4E4E7" }}>{tier.name}</h3>
                    <div className="mt-3 flex items-end gap-1">
                      <span className="text-4xl font-bold" style={{ color: "#FFFFFF" }}>{tier.price}</span>
                      <span className="mb-1" style={{ color: "#52525B" }}>/mo</span>
                    </div>
                    <p className="text-xs mt-1 mb-4 sm:mb-6" style={{ color: "#3F3F46" }}>billed monthly</p>
                    <ul className="space-y-2 sm:space-y-2.5 flex-1">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: "#9898B0" }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={{ color: "#A78BFA" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <a
                      href="#waitlist"
                      className="w-full mt-6 sm:mt-8 font-semibold py-3 rounded-xl text-sm text-center block transition-opacity hover:opacity-90 active:opacity-95"
                      style={{ background: "#7C5CFC", color: "#FFFFFF", boxShadow: "0 4px 20px rgba(124,92,252,0.4)" }}
                    >
                      Start free trial
                    </a>
                  </div>
                </div>
              ) : (
                <div
                  className="p-4 sm:p-6 h-full flex flex-col rounded-2xl"
                  style={{ border: "1px solid rgba(255,255,255,0.07)", boxShadow: GLASS_SHADOW }}
                >
                  <h3 className="font-semibold" style={{ color: "#E4E4E7" }}>{tier.name}</h3>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-bold" style={{ color: "#FFFFFF" }}>{tier.price}</span>
                    <span className="mb-1" style={{ color: "#52525B" }}>/mo</span>
                  </div>
                  <p className="text-xs mt-1 mb-4 sm:mb-6" style={{ color: "#3F3F46" }}>billed monthly</p>
                  <ul className="space-y-2 sm:space-y-2.5 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs sm:text-sm" style={{ color: "#9898B0" }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={{ color: "#4ADE80" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#waitlist"
                    className="w-full mt-8 font-semibold py-3 rounded-xl text-sm text-center block transition-opacity hover:opacity-90"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "#E8E8F0" }}
                  >
                    Start free trial
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section id="waitlist" className="py-16 sm:py-20 md:py-28 text-center px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-2xl mx-auto relative"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: 700,
              height: 350,
              background: "radial-gradient(ellipse, rgba(124,92,252,0.06) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 relative z-10">Get early access</h2>
          <p className="text-base sm:text-lg mb-8 sm:mb-10 relative z-10 px-2" style={{ color: "#6B6B80" }}>
            We&apos;re opening to a limited number of creators.<br />
            Join the waitlist and we&apos;ll let you in first.
          </p>
          <div className="flex justify-center relative z-10 w-full max-w-sm mx-auto px-2">
            <WaitlistForm size="lg" source="bottom_cta" />
          </div>
          <p className="mt-4 text-xs relative z-10" style={{ color: "#3F3F46" }}>
            7-day free trial when you get in · No credit card required
          </p>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="py-8 px-4 sm:px-6 lg:px-8"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold" style={{ color: "#E4E4E7" }}>Clack</Link>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-sm transition-opacity hover:opacity-80" style={{ color: "#52525B" }}>Privacy</Link>
            <Link href="/terms" className="text-sm transition-opacity hover:opacity-80" style={{ color: "#52525B" }}>Terms</Link>
            <a href="mailto:hello@clack.app" className="text-sm transition-opacity hover:opacity-80" style={{ color: "#52525B" }}>Contact</a>
          </div>
        </div>
        <p className="text-center text-xs mt-6" style={{ color: "#3F3F46" }}>
          © {new Date().getFullYear()} Clack. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
