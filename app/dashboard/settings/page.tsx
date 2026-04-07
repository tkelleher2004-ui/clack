"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard, GlassInput, GlassButton, GlassSelect } from "@/components/ui";
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

const GOALS_TIMEFRAME_OPTIONS = [
  { value: "1_month", label: "1 month — I need results fast" },
  { value: "3_months", label: "3 months — steady growth" },
  { value: "6_months", label: "6 months — building long-term" },
  { value: "1_year", label: "1 year — playing the long game" },
  { value: "none", label: "No specific timeframe" },
];

interface BrandProfile {
  business_name: string;
  industry: string;
  website_url: string;
  target_audience: string;
  audience_age_range: string;
  brand_voice: string;
  goals_raw: string;
  goals_timeframe: string;
}

export default function SettingsPage() {
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profile, setProfile] = useState<BrandProfile>({
    business_name: "",
    industry: "",
    website_url: "",
    target_audience: "",
    audience_age_range: "",
    brand_voice: "",
    goals_raw: "",
    goals_timeframe: "",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? "");

      const { data } = await supabase
        .from("brand_profiles")
        .select("business_name,industry,website_url,target_audience,audience_age_range,brand_voice,goals_raw,goals_timeframe")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          business_name: data.business_name ?? "",
          industry: data.industry ?? "",
          website_url: data.website_url ?? "",
          target_audience: data.target_audience ?? "",
          audience_age_range: data.audience_age_range ?? "",
          brand_voice: data.brand_voice ?? "",
          goals_raw: data.goals_raw ?? "",
          goals_timeframe: data.goals_timeframe ?? "",
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const update = (key: keyof BrandProfile, value: string) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Session expired"); return; }

    const { error } = await supabase.from("brand_profiles").upsert(
      {
        user_id: user.id,
        business_name: profile.business_name || null,
        industry: profile.industry || null,
        website_url: profile.website_url || null,
        target_audience: profile.target_audience || null,
        audience_age_range: profile.audience_age_range || null,
        brand_voice: profile.brand_voice || null,
        goals_raw: profile.goals_raw || null,
        goals_timeframe: profile.goals_timeframe || null,
        goals_updated_at: profile.goals_raw ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved");
  }

  async function handlePasswordChange() {
    if (!newPassword) { toast.error("Enter a new password"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match"); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }

    setChangingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);

    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    setNewPassword("");
    setConfirmPassword("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: "#111118" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "#8A8A9A" }}>Manage your profile and brand configuration</p>
      </div>

      {/* Account */}
      <GlassCard className="p-6 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: "#111118" }}>Account</h2>
        <div>
          <p className="text-xs mb-1" style={{ color: "#8A8A9A" }}>Email</p>
          <p className="text-sm font-medium" style={{ color: "#111118" }}>{userEmail}</p>
        </div>

        <div className="pt-2 space-y-3">
          <p className="text-xs font-medium" style={{ color: "#505060" }}>Change password</p>
          <GlassInput
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 8 characters"
          />
          <GlassInput
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
          />
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={handlePasswordChange}
            disabled={changingPassword}
          >
            {changingPassword ? "Updating..." : "Update password"}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Brand Profile */}
      <GlassCard className="p-6 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: "#111118" }}>Brand profile</h2>

        <GlassInput
          label="Business name"
          value={profile.business_name}
          onChange={(e) => update("business_name", e.target.value)}
          placeholder="Acme Inc."
        />
        <GlassSelect
          label="Industry"
          options={INDUSTRIES}
          value={profile.industry}
          onChange={(e) => update("industry", e.target.value)}
          placeholder="Select industry"
        />
        <GlassInput
          label="Website URL"
          type="url"
          value={profile.website_url}
          onChange={(e) => update("website_url", e.target.value)}
          placeholder="https://example.com"
        />
        <GlassInput
          label="Target audience"
          value={profile.target_audience}
          onChange={(e) => update("target_audience", e.target.value)}
          placeholder="e.g. Tech-savvy millennials interested in productivity"
        />
        <GlassInput
          label="Audience age range"
          value={profile.audience_age_range}
          onChange={(e) => update("audience_age_range", e.target.value)}
          placeholder="e.g. 25–34"
        />
        <GlassSelect
          label="Brand voice"
          options={BRAND_VOICES}
          value={profile.brand_voice}
          onChange={(e) => update("brand_voice", e.target.value)}
          placeholder="Select brand voice"
        />
      </GlassCard>

      {/* Goals */}
      <GlassCard className="p-6 space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: "#111118" }}>Goals</h2>
        <div className="space-y-1">
          <label className="block text-xs font-medium" style={{ color: "#505060" }}>
            What are you trying to achieve?
          </label>
          <textarea
            value={profile.goals_raw}
            onChange={(e) => update("goals_raw", e.target.value)}
            placeholder="e.g. Grow to 10K followers by summer, get more brand deals..."
            rows={3}
            className="w-full rounded-xl px-3 py-2 text-sm resize-none outline-none transition-colors"
            style={{
              background: "rgba(0,0,0,0.04)",
              border: "1px solid rgba(0,0,0,0.07)",
              color: "#111118",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,92,252,0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)")}
          />
        </div>
        <GlassSelect
          label="Timeframe"
          options={GOALS_TIMEFRAME_OPTIONS}
          value={profile.goals_timeframe}
          onChange={(e) => update("goals_timeframe", e.target.value)}
          placeholder="Select timeframe"
        />
      </GlassCard>

      <GlassButton onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save settings"}
      </GlassButton>
    </div>
  );
}
