import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
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
    default: "UNI Licitações",
    template: "%s | UNI Licitações",
  },
  description:
    "Plataforma de inteligência e gestão de oportunidades em licitações públicas.",
  applicationName: "UNI Licitações",
};

const themeBootstrap = `
(() => {
  const KEY = "uni-theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const preference = localStorage.getItem(KEY) || "system";
    const isDark = preference === "dark" || (preference === "system" && media.matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.dataset.theme = preference;
  };
  apply();
  window.addEventListener("uni-theme-change", apply);
  media.addEventListener?.("change", () => {
    if ((localStorage.getItem(KEY) || "system") === "system") apply();
  });
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
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
