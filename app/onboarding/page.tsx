"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { GlassButton, GlassCard, GlassInput, GlassSelect, PageTransition } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "health", label: "Health & Wellness" },
  { value: "finance", label: "Finance" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

const BRAND_VOICES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "bold", label: "Bold" },
  { value: "educational", label: "Educational" },
  { value: "playful", label: "Playful" },
];

const ACCENT_COLORS = ["#E4E4E7", "#A1A1AA", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B"];

const STEPS = [
  { id: 1, label: "Business" },
  { id: 2, label: "Audience" },
  { id: 3, label: "Voice" },
  { id: 4, label: "Branding" },
  { id: 5, label: "Goals" },
];

const GOALS_TIMEFRAME_OPTIONS = [
  { value: "1_month", label: "1 month — I need results fast" },
  { value: "3_months", label: "3 months — steady growth" },
  { value: "6_months", label: "6 months — building long-term" },
  { value: "1_year", label: "1 year — playing the long game" },
  { value: "none", label: "No specific timeframe" },
];

const GOALS_EXAMPLE_PROMPTS = [
  "Grow to 10K followers by summer",
  "Get more brand deals",
  "Go viral — hit 1M views on a video",
  "Launch my new product to my audience",
  "Grow my TikTok from scratch",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    business_name: "", industry: "", website_url: "",
    target_audience: "", audience_age_range: "",
    brand_voice: "", logo_url: "", accent_color: "#E4E4E7",
    goals_raw: "", goals_timeframe: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length) setLogoFile(acceptedFiles[0]!);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, maxFiles: 1,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    disabled: loading,
  });

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const canProceed = () => {
    if (step === 1) return form.business_name.trim() && form.industry && form.website_url.trim();
    if (step === 2) return form.target_audience.trim() && form.audience_age_range;
    if (step === 3) return form.brand_voice;
    if (step === 5) return form.goals_raw.trim();
    return true;
  };

  const handleNext = () => { if (step < 5) setStep((s) => s + 1); else handleSubmit(); };

  const handleSubmit = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Session expired."); router.push("/login"); return; }

    let logo_url = form.logo_url;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `${user.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from("brand-assets").upload(path, logoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path);
        logo_url = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("brand_profiles").upsert({
      user_id: user.id, business_name: form.business_name.trim(), industry: form.industry,
      website_url: form.website_url.trim() || null, target_audience: form.target_audience.trim(),
      audience_age_range: form.audience_age_range, brand_voice: form.brand_voice,
      logo_url: logo_url || null, accent_color: form.accent_color,
      goals_raw: form.goals_raw.trim() || null, goals_timeframe: form.goals_timeframe || null,
      goals_updated_at: form.goals_raw.trim() ? new Date().toISOString() : null,
    }, { onConflict: "user_id" });

    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved!");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <PageTransition className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#E4E4E7' }}>Clack</h1>
          <p className="mt-1 text-sm" style={{ color: '#71717A' }}>Set up your brand profile</p>
        </div>

        <div className="flex gap-2 mb-8">
          {STEPS.map((s) => (
            <button
              key={s.id} type="button" onClick={() => setStep(s.id)}
              className="flex-1 h-2 rounded-full transition-all"
              style={{ backgroundColor: step >= s.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)' }}
              aria-label={`Step ${s.id}: ${s.label}`}
            />
          ))}
        </div>

        <GlassCard className="p-6 md:p-8" hover={false}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-4">
                <h2 className="text-lg font-semibold" style={{ color: '#E4E4E7' }}>Business details</h2>
                <GlassInput label="Business name" value={form.business_name} onChange={(e) => update("business_name", e.target.value)} placeholder="Acme Inc." required />
                <GlassSelect label="Industry" options={INDUSTRIES} value={form.industry} onChange={(e) => update("industry", e.target.value)} placeholder="Select industry" />
                <GlassInput label="Website URL" type="url" value={form.website_url} onChange={(e) => update("website_url", e.target.value)} placeholder="https://example.com" />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-4">
                <h2 className="text-lg font-semibold" style={{ color: '#E4E4E7' }}>Target audience</h2>
                <label className="block text-sm font-medium mb-2" style={{ color: '#E4E4E7' }}>Audience description</label>
                <textarea
                  className="w-full px-4 py-3 transition-all duration-200 outline-none resize-y min-h-[120px]"
                  style={{
                    background: 'transparent',
                    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#E4E4E7',
                    boxShadow: [
                      'inset 0 1px 0 0 rgba(255,255,255,0.22)',
                      'inset 1px 0 0 0 rgba(255,255,255,0.12)',
                      'inset -1px 0 0 0 rgba(255,255,255,0.05)',
                      'inset 0 -1px 0 0 rgba(255,255,255,0.03)',
                      '0 2px 12px rgba(0,0,0,0.3)',
                    ].join(', '),
                  }}
                  placeholder="Who are your ideal viewers?" value={form.target_audience}
                  onChange={(e) => update("target_audience", e.target.value)} required
                />
                <GlassInput label="Age range" value={form.audience_age_range} onChange={(e) => update("audience_age_range", e.target.value)} placeholder="e.g. 25-44" />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-4">
                <h2 className="text-lg font-semibold" style={{ color: '#E4E4E7' }}>Brand voice</h2>
                <GlassSelect label="How should your content sound?" options={BRAND_VOICES} value={form.brand_voice} onChange={(e) => update("brand_voice", e.target.value)} placeholder="Select voice" />
              </motion.div>
            )}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-6">
                <h2 className="text-lg font-semibold" style={{ color: '#E4E4E7' }}>Branding</h2>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#E4E4E7' }}>Logo (optional)</label>
                  <div
                    {...getRootProps()} className="cursor-pointer transition-all duration-300"
                    style={{
                      border: isDragActive ? '2px dashed rgba(255,255,255,0.2)' : '2px dashed rgba(255,255,255,0.08)',
                      borderRadius: '14px', padding: '2rem', textAlign: 'center',
                    }}
                  >
                    <input {...getInputProps()} />
                    {logoFile
                      ? <p style={{ color: '#E4E4E7' }}>{logoFile.name}</p>
                      : <p style={{ color: '#71717A' }}>Drop your logo here or click to upload</p>
                    }
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#E4E4E7' }}>Brand accent color</label>
                  <div className="flex gap-3 flex-wrap">
                    {ACCENT_COLORS.map((color) => (
                      <button key={color} type="button" onClick={() => update("accent_color", color)}
                        className="w-10 h-10 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: color, borderRadius: '12px',
                          border: form.accent_color === color ? '2px solid rgba(255,255,255,0.6)' : '2px solid rgba(255,255,255,0.08)',
                          boxShadow: form.accent_color === color ? '0 0 0 2px rgba(255,255,255,0.15)' : 'none',
                        }}
                        aria-label={`Pick ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-4">
                <h2 className="text-lg font-semibold" style={{ color: '#E4E4E7' }}>What are you trying to accomplish?</h2>
                <div>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-3 transition-all duration-200 outline-none resize-y min-h-[100px]"
                    style={{
                      background: 'transparent',
                      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                      borderRadius: '14px',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#E4E4E7',
                      boxShadow: [
                        'inset 0 1px 0 0 rgba(255,255,255,0.22)',
                        'inset 1px 0 0 0 rgba(255,255,255,0.12)',
                        'inset -1px 0 0 0 rgba(255,255,255,0.05)',
                        'inset 0 -1px 0 0 rgba(255,255,255,0.03)',
                        '0 2px 12px rgba(0,0,0,0.3)',
                      ].join(', '),
                    }}
                    placeholder="e.g. I want to grow my Instagram to 10K followers by June, start getting brand deals, and post 3x per week consistently"
                    value={form.goals_raw}
                    onChange={(e) => update("goals_raw", e.target.value)}
                    required
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {GOALS_EXAMPLE_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, goals_raw: prompt }))}
                        className="px-3 py-1.5 rounded-full text-xs transition-all duration-200"
                        style={{
                          background: 'transparent',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          color: '#A1A1AA',
                          boxShadow: [
                            'inset 0 1px 0 0 rgba(255,255,255,0.08)',
                            '0 2px 8px rgba(0,0,0,0.3)',
                          ].join(', '),
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
                <GlassSelect
                  label="What's your timeframe?"
                  options={GOALS_TIMEFRAME_OPTIONS}
                  value={form.goals_timeframe}
                  onChange={(e) => update("goals_timeframe", e.target.value)}
                  placeholder="Select timeframe"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex justify-between">
            <GlassButton type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>Back</GlassButton>
            <GlassButton type="button" onClick={handleNext} disabled={!canProceed() || loading} loading={loading}>
              {step === 5 ? "Finish" : "Next"}
            </GlassButton>
          </div>
        </GlassCard>
      </PageTransition>
    </div>
  );
}
