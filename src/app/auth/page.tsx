import { redirect } from "next/navigation";
import ThreeDMarquee from "@/components/ui/background/ThreeDMarquee";
import AuthForm from "@/components/sections/Auth/AuthForm";
import BackButton from "@/components/ui/button/BackButton";
import { getPosterWall } from "@/server/queries/titles";
import { getSession } from "@/server/session";
import { serverEnv } from "@/server/env";
import type { SearchParams } from "@/types/dto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Đăng nhập" };

export default async function AuthPage({ searchParams }: SearchParams) {
  const rawNext = (await searchParams).next;
  const next = typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  if (await getSession()) redirect(next);

  const posters = await getPosterWall();

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      {posters.length >= 8 && (
        <ThreeDMarquee images={posters} className="pointer-events-none absolute inset-0 opacity-40" />
      )}
      <div className="from-background via-background/70 to-background absolute inset-0 bg-radial" />
      <div className="absolute top-4 left-4 z-10">
        <BackButton href="/" />
      </div>
      <div className="relative z-10 flex w-full justify-center">
        <AuthForm next={next} allowSignup={serverEnv.allowSignup} />
      </div>
    </div>
  );
}
