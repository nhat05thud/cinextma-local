import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

/** Session của request hiện tại (cache trong 1 lần render). */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const getUser = async () => (await getSession())?.user ?? null;

export const isAdminUser = (user: { role?: string | null } | null | undefined) =>
  !!user?.role?.split(",").includes("admin");

/** Dùng trong layout/page admin: chuyển hướng nếu không phải admin. */
export const requireAdminPage = async () => {
  const session = await getSession();
  if (!session) redirect("/auth?next=/admin");
  if (!isAdminUser(session.user)) redirect("/");
  return session;
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Dùng trong server action / route handler admin: ném lỗi nếu không phải admin. */
export const requireAdmin = async () => {
  const session = await getSession();
  if (!session || !isAdminUser(session.user)) throw new HttpError(403, "Bạn không có quyền admin");
  return session;
};

/** Kiểm tra quyền admin trực tiếp từ headers (cho route handler không dùng next/headers). */
export const isAdminRequest = async (requestHeaders: Headers) => {
  const session = await auth.api.getSession({ headers: requestHeaders });
  return isAdminUser(session?.user);
};
