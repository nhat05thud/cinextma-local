import SettingsForm from "@/components/admin/manage/SettingsForm";
import { getSettings } from "@/server/queries/settings";
import { getSystemInfo } from "@/server/queries/admin";

export const metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const [settings, system] = await Promise.all([getSettings(), getSystemInfo()]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Cài đặt</h1>
      <SettingsForm settings={settings} system={system} />
    </div>
  );
}
