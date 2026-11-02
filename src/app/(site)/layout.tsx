import TopNavbar from "@/components/ui/layout/TopNavbar";
import BottomNavbar from "@/components/ui/layout/BottomNavbar";
import Sidebar from "@/components/ui/layout/Sidebar";
import Footer from "@/components/ui/layout/Footer";
import { cn } from "@/utils/helpers";
import { SpacingClasses } from "@/utils/constants";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNavbar />
      <Sidebar>
        <div className="flex min-h-dvh w-full min-w-0 flex-col">
          <main className={cn("container mx-auto max-w-full flex-1", SpacingClasses.main)}>{children}</main>
          <Footer />
        </div>
      </Sidebar>
      <BottomNavbar />
    </>
  );
}
