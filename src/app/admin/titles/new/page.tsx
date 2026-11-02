import NewTitle from "@/components/admin/title/NewTitle";
import { getTmdbToken } from "@/server/admin/tmdb";

export const metadata = { title: "Thêm phim" };

export default async function NewTitlePage() {
  return <NewTitle tmdbConfigured={!!(await getTmdbToken())} />;
}
