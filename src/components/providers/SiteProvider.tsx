"use client";

import { createContext, useContext } from "react";
import type { SiteSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export type SiteUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

type SiteContextValue = { settings: SiteSettings; user: SiteUser | null };

const SiteContext = createContext<SiteContextValue>({ settings: DEFAULT_SETTINGS, user: null });

/** Cài đặt site + người dùng hiện tại, lấy từ server ở layout để không bị nháy giao diện. */
export const SiteProvider: React.FC<React.PropsWithChildren<SiteContextValue>> = ({ children, ...value }) => (
  <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
);

export const useSite = () => useContext(SiteContext);
export const useCurrentUser = () => useContext(SiteContext).user;
