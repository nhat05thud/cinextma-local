import "server-only";
import { cache } from "react";
import { prisma } from "../db";
import { DEFAULT_SETTINGS, type SiteSettings } from "@/lib/settings";

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await prisma.setting.findMany().catch(() => []);
  const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    siteName: values.siteName || DEFAULT_SETTINGS.siteName,
    siteDescription: values.siteDescription || DEFAULT_SETTINGS.siteDescription,
    footerText: values.footerText || DEFAULT_SETTINGS.footerText,
    homeRowLimit: Number(values.homeRowLimit) || DEFAULT_SETTINGS.homeRowLimit,
  };
});
