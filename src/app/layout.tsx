import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { CSSProperties } from "react";
import { brand } from "@/config/brand";
import { colourVars, companyIdForHost, earlyColourScript, findDemoCompany } from "@/config/demo-companies";
import { CompanyFromLink } from "@/lib/demo-company";
import "./globals.css";

/** The company this web address belongs to (e.g. a "nicol" address → Nicol of Skene). */
async function companyForThisAddress() {
  return findDemoCompany(companyIdForHost((await headers()).get("host") ?? ""));
}

export async function generateMetadata(): Promise<Metadata> {
  const company = await companyForThisAddress();
  const icons = company.iconSet;
  return {
    title: company.id === "default" ? brand.shortName : `${brand.shortName} · ${company.companyName}`,
    description: "Weekly timesheets, signed on your phone",
    // What phones use when the app is added to the home screen.
    manifest: `${icons}/manifest.webmanifest`,
    icons: {
      icon: [
        { url: `${icons}/favicon-32.png`, sizes: "32x32", type: "image/png" },
        { url: `${icons}/icon-192.png`, sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: `${icons}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "default" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const company = await companyForThisAddress();
  return { themeColor: company.colours.primary, width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const company = await companyForThisAddress();
  return (
    // suppressHydrationWarning: a demo company chosen by ?demo= may already be applied by the script below.
    <html lang="en-GB" style={colourVars(company.colours) as CSSProperties} className="h-full antialiased" suppressHydrationWarning>
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
