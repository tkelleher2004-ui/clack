"use client";

import { useState, useRef, useEffect } from "react";
import { useUserGoal } from "@/lib/context/UserGoalContext";
import type { UserGoal, PrimaryGoal } from "@/lib/types/social";

const GOAL_OPTIONS: { value: PrimaryGoal; label: string }[] = [
  { value: "grow_audience", label: "Grow Audience" },
  { value: "go_viral", label: "Go Viral" },
  { value: "drive_conversions", label: "Drive Conversions" },
  { value: "build_brand", label: "Build Brand" },
];

export function GoalBar() {
  const { userGoal, setUserGoal, triggerRefresh, isLoading } = useUserGoal();
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [focusDraft, setFocusDraft] = useState("");
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingFocus]);

  if (isLoading) return null;

  const saveFocus = async (newFocus: string) => {
    if (!newFocus.trim()) return;
    setIsSaving(true);
    const updated: UserGoal = {
      primaryGoal: userGoal?.primaryGoal ?? "grow_audience",
      currentFocus: newFocus.trim(),
      weeklyTarget: userGoal?.weeklyTarget ?? "3 posts/week",
      updatedAt: new Date().toISOString(),
    };
    await setUserGoal(updated);
    triggerRefresh();
    setIsEditingFocus(false);
    setIsSaving(false);
  };

  const changeGoalType = async (goal: PrimaryGoal) => {
    setShowGoalDropdown(false);
    setIsSaving(true);
    const updated: UserGoal = {
      primaryGoal: goal,
      currentFocus: userGoal?.currentFocus ?? "",
      weeklyTarget: userGoal?.weeklyTarget ?? "3 posts/week",
      updatedAt: new Date().toISOString(),
    };
    await setUserGoal(updated);
    triggerRefresh();
    setIsSaving(false);
  };

  const goalLabel = GOAL_OPTIONS.find((g) => g.value === userGoal?.primaryGoal)?.label ?? "Set Goal";
  const focus = userGoal?.currentFocus ?? "";

  return (
    <div
      className="flex items-center gap-3"
    >
      {/* Goal type pill */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowGoalDropdown((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
          style={{
            background: "rgba(124,92,252,0.10)",
            border: "1px solid rgba(124,92,252,0.25)",
            color: "#A78BFA",
          }}
        >
          <span style={{ fontSize: "10px" }}>◎</span>
          {goalLabel}
          <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showGoalDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowGoalDropdown(false)} aria-hidden />
            <div
              className="absolute top-full left-0 mt-1 py-1 z-20 rounded-xl overflow-hidden"
              style={{
                minWidth: "160px",
                background: "#1A1A1A",
                border: "1px solid rgba(255,255,255,0.09)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              {GOAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => changeGoalType(opt.value)}
                  className="w-full text-left px-3 py-2 text-[12px] transition-colors"
                  style={{
                    color: opt.value === userGoal?.primaryGoal ? "#A78BFA" : "#9090AA",
                    background: opt.value === userGoal?.primaryGoal ? "rgba(124,92,252,0.08)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      opt.value === userGoal?.primaryGoal ? "rgba(124,92,252,0.08)" : "transparent";
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.08)" }} />

      {/* Focus — inline editable */}
      {isEditingFocus ? (
        <form
          className="flex items-center gap-2 flex-1 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            saveFocus(focusDraft);
          }}
        >
          <input
            ref={inputRef}
            value={focusDraft}
            onChange={(e) => setFocusDraft(e.target.value)}
            onBlur={() => {
              if (focusDraft.trim() && focusDraft.trim() !== focus) {
                saveFocus(focusDraft);
              } else {
                setIsEditingFocus(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsEditingFocus(false);
              }
            }}
            placeholder="What are you focused on? e.g. AI news, tutorials, build in public..."
            className="flex-1 text-[12px] bg-transparent outline-none min-w-0"
            style={{ color: "#F0F0F8" }}
            disabled={isSaving}
          />
          <span className="text-[10px] shrink-0" style={{ color: "#5A5A78" }}>
            Enter to save · Esc to cancel
          </span>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFocusDraft(focus);
            setIsEditingFocus(true);
          }}
          className="flex items-center gap-2 flex-1 min-w-0 text-left group"
        >
          {focus ? (
            <span className="text-[12px] truncate" style={{ color: "#9090AA" }}>
              {focus}
            </span>
          ) : (
            <span className="text-[12px] italic" style={{ color: "#5A5A78" }}>
              Click to set your content focus...
            </span>
          )}
          <svg
            className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: "#5A5A78" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}

      {/* Weekly target */}
      {userGoal?.weeklyTarget && (
        <>
          <div className="w-px h-4 hidden sm:block" style={{ background: "rgba(255,255,255,0.08)" }} />
          <span className="text-[11px] hidden sm:block shrink-0" style={{ color: "#5A5A78" }}>
            {userGoal.weeklyTarget}
          </span>
        </>
      )}

      {isSaving && (
        <span className="text-[10px] animate-pulse shrink-0" style={{ color: "#A78BFA" }}>
          Saving...
        </span>
      )}
    </div>
  );
}
