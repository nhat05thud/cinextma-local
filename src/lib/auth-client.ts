"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

// Không đặt baseURL: client dùng origin hiện tại, nên chạy được qua localhost, tên miền IIS hay IP LAN.
export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
