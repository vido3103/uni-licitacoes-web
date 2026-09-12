"use client";

import ApprovedClientOnboarding from "@/modules/onboarding/ApprovedClientOnboarding";

export default function CompanyOnboarding() {
  return <ApprovedClientOnboarding onNavigate={(module) => {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("uni-navigate", { detail: module }));
  }} />;
}
