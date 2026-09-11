"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const POLL_MS = 5000;

export default function AiQueueRunner() {
  const running = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    async function tick() {
      if (cancelled || running.current || !supabase) return;
      running.current = true;
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        const { data: membership, error: membershipError } = await supabase
          .from("client_members")
          .select("client_id")
          .eq("user_id", auth.user.id)
          .limit(1)
          .maybeSingle();
        if (membershipError || !membership?.client_id) return;

        const { data: job, error: queueError } = await supabase
          .from("opportunity_ai_analysis_queue")
          .select("id,status")
          .eq("client_id", membership.client_id)
          .in("status", ["pending", "retry_wait"])
          .order("queued_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (queueError || !job?.id) return;

        const { error: workerError } = await supabase.functions.invoke("uni-analysis-worker-gemini", {
          body: { queue_id: job.id },
        });
        if (workerError) console.error("UNI Gemini worker invocation failed", workerError);
      } catch (error) {
        console.error("UNI AI queue runner failed", error);
      } finally {
        running.current = false;
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
