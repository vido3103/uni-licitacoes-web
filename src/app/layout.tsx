import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import OrganizationSelector from "@/components/OrganizationSelector";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Veence | V&S NASCIMENTO",
    template: "%s | Veence",
  },
  description:
    "Veence — plataforma de inteligência e gestão de oportunidades em licitações públicas da V&S NASCIMENTO.",
  applicationName: "Veence",
};

const themeBootstrap = `
(() => {
  const KEY = "uni-theme";
  const BASELINE_KEY = "uni-theme-baseline";
  const BASELINE = "approved-light-2026-09-14";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  if (localStorage.getItem(BASELINE_KEY) !== BASELINE) {
    localStorage.setItem(KEY, "light");
    localStorage.setItem(BASELINE_KEY, BASELINE);
  }
  const apply = () => {
    const preference = localStorage.getItem(KEY) || "light";
    const isDark = preference === "dark" || (preference === "system" && media.matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = preference;
  };
  apply();
  window.addEventListener("uni-theme-change", apply);
  media.addEventListener?.("change", () => {
    if ((localStorage.getItem(KEY) || "light") === "system") apply();
  });
})();
`;

const organizationBootstrap = `
(() => {
  const ACTIVE_KEY = "veence-active-organization-id";
  const LEGACY_OWNER_KEY = "uni-owner-client-id";
  const legacy = sessionStorage.getItem(LEGACY_OWNER_KEY);
  if (legacy && !sessionStorage.getItem(ACTIVE_KEY)) {
    sessionStorage.setItem(ACTIVE_KEY, legacy);
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        <script dangerouslySetInnerHTML={{ __html: organizationBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col"><OrganizationSelector />{children}</body>
    </html>
  );
}
