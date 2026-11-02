import type { Metadata, Viewport } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { siteConfig } from "@/config/site";
import { BeVietnam, Saira } from "@/utils/fonts";
import { cn } from "@/utils/helpers";
import { getSettings } from "@/server/queries/settings";
import { getSession, isAdminUser } from "@/server/session";
import { serverEnv } from "@/server/env";
import { SiteProvider } from "@/components/providers/SiteProvider";
import Providers from "./providers";
import "../styles/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(serverEnv.authUrl),
    title: { default: settings.siteName, template: `%s | ${settings.siteName}` },
    applicationName: settings.siteName,
    description: settings.siteDescription,
    manifest: "/manifest.json",
    icons: { icon: siteConfig.favicon },
    openGraph: {
      type: "website",
      siteName: settings.siteName,
      title: settings.siteName,
      description: settings.siteDescription,
      locale: "vi_VN",
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0C0F" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, session] = await Promise.all([getSettings(), getSession()]);
  const user = session
    ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
        isAdmin: isAdminUser(session.user),
      }
    : null;

  return (
    <html suppressHydrationWarning lang="vi">
      <body
        className={cn(
          "bg-background min-h-dvh antialiased",
          BeVietnam.className,
          BeVietnam.variable,
          Saira.variable,
        )}
      >
        <NuqsAdapter>
            <SiteProvider settings={settings} user={user}>
              <Providers>{children}</Providers>
            </SiteProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
