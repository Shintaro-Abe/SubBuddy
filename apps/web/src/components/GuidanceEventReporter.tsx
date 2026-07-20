"use client";

import { useEffect, useRef } from "react";
import { authenticatedFetch } from "@/lib/client-api";

type GuidanceEvent =
  | "inventory_completed"
  | "spending_viewed"
  | "review_viewed"
  | "measurement_configured"
  | "measurement_skipped"
  | "measurement_reset";

export function GuidanceEventReporter({ event }: { event: GuidanceEvent }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void authenticatedFetch("/api/guidance-progress", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event }),
    });
  }, [event]);

  return null;
}
