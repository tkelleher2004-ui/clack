"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserGoal } from "@/lib/types/social";

export interface ChatContext {
  label: string;   // e.g. "Total Views"
  value: string;   // e.g. "1.2M"
  detail: string;  // full detail for the AI, e.g. "1,234,567 total (TT: 980K, IG: 220K)"
}

interface UserGoalContextValue {
  userGoal: UserGoal | null;
  setUserGoal: (goal: UserGoal) => Promise<void>;
  isLoading: boolean;
  refreshSignal: number;
  triggerRefresh: () => void;
  consumeRefresh: () => boolean;
  chatContext: ChatContext | null;
  setChatContext: (ctx: ChatContext) => void;
  clearChatContext: () => void;
}

const UserGoalContext = createContext<UserGoalContextValue | null>(null);

export function UserGoalProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) {
  const [userGoal, setGoalState] = useState<UserGoal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [chatContext, setChatContextState] = useState<ChatContext | null>(null);
  const pendingRefreshRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ai_artifacts")
      .select("data")
      .eq("user_id", userId)
      .eq("type", "user_goal")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.data) setGoalState(data.data as UserGoal);
        setIsLoading(false);
      });
  }, [userId]);

  const setUserGoal = useCallback(
    async (goal: UserGoal) => {
      setGoalState(goal);
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("ai_artifacts")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "user_goal")
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from("ai_artifacts")
          .update({ data: goal })
          .eq("id", existing.id);
      } else {
        await supabase.from("ai_artifacts").insert({
          user_id: userId,
          type: "user_goal",
          title: "User Goal",
          data: goal,
          pinned: false,
        });
      }
    },
    [userId]
  );

  const triggerRefresh = useCallback(() => {
    console.log("[UserGoalContext] triggerRefresh called — incrementing refreshSignal");
    pendingRefreshRef.current = true;
    setRefreshSignal((s) => s + 1);
  }, []);

  // Returns true (and clears the flag) if a refresh was triggered while the consumer was unmounted
  const consumeRefresh = useCallback(() => {
    if (pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      return true;
    }
    return false;
  }, []);

  const setChatContext = useCallback((ctx: ChatContext) => {
    setChatContextState(ctx);
  }, []);

  const clearChatContext = useCallback(() => {
    setChatContextState(null);
  }, []);

  return (
    <UserGoalContext.Provider value={{ userGoal, setUserGoal, isLoading, refreshSignal, triggerRefresh, consumeRefresh, chatContext, setChatContext, clearChatContext }}>
      {children}
    </UserGoalContext.Provider>
  );
}

export function useUserGoal() {
  const ctx = useContext(UserGoalContext);
  if (!ctx) throw new Error("useUserGoal must be used within UserGoalProvider");
  return ctx;
}
