import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { brand } from "@/config/brand";
import { earlyColourScript } from "@/config/demo-companies";
import { CompanyFromLink } from "@/lib/demo-company";
import "./globals.css";

export const metadata: Metadata = {
  title: brand.shortName,
  description: "Weekly timesheets, signed on your phone",
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
  "--brand-accent": brand.colours.accent,
  "--brand-background": brand.colours.background,
  "--brand-surface": brand.colours.surface,
  "--brand-text": brand.colours.text,
  "--brand-muted": brand.colours.muted,
  "--brand-border": brand.colours.border,
  "--brand-danger": brand.colours.danger,
} as CSSProperties;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: a demo company's colours may already be applied by the script below.
    <html lang="en-GB" style={brandVars} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: earlyColourScript() }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <CompanyFromLink />
        {children}
      </body>
    </html>
  );
}
