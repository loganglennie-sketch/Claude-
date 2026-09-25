import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.shortName} · ${brand.companyName}`,
  description: `Weekly timesheets for ${brand.companyName}`,
};

export const viewport: Viewport = {
  themeColor: brand.colours.primary,
  width: "device-width",
  initialScale: 1,
};

const brandVars = {
  "--brand-primary": brand.colours.primary,
  "--brand-primary-dark": brand.colours.primaryDark,
  "--brand-primary-soft": brand.colours.primarySoft,
  "--brand-background": brand.colours.background,
  "--brand-surface": brand.colours.surface,
  "--brand-text": brand.colours.text,
  "--brand-muted": brand.colours.muted,
  "--brand-border": brand.colours.border,
  "--brand-danger": brand.colours.danger,
} as CSSProperties;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" style={brandVars} className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
