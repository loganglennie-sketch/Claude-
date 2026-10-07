import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { settings } from "@/config/settings";
import { OfflineSupport } from "@/components/OfflineSupport";
import "./globals.css";

export const metadata: Metadata = {
  title: settings.shortName,
  description: "Offshore trip timesheets, approved by the client's supervisor",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: settings.shortName, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: settings.colours.primary, width: "device-width", initialScale: 1 };

const c = settings.colours;
const colourVars = {
  "--c-primary": c.primary,
  "--c-primary-dark": c.primaryDark,
  "--c-primary-soft": c.primarySoft,
  "--c-background": c.background,
  "--c-surface": c.surface,
  "--c-text": c.text,
  "--c-muted": c.muted,
  "--c-border": c.border,
  "--c-danger": c.danger,
  "--c-warning": c.warning,
  "--c-success": c.success,
} as CSSProperties;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" style={colourVars} className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <OfflineSupport />
        {children}
      </body>
    </html>
  );
}
