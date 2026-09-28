"use client";

import { usePathname } from "next/navigation";
import OrganizationSelector from "@/components/OrganizationSelector";

export default function ScopedOrganizationSelector() {
  const pathname = usePathname();
  return pathname?.startsWith("/hml/") ? null : <OrganizationSelector />;
}
