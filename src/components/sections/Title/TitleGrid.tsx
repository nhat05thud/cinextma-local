import type { TitleCardDTO } from "@/types/dto";
import PosterCard from "./PosterCard";

const TitleGrid: React.FC<{ titles: TitleCardDTO[]; empty?: React.ReactNode }> = ({ titles, empty }) => {
  if (!titles.length) {
    return (
      <div className="text-foreground-500 flex min-h-48 flex-col items-center justify-center gap-2 text-center">
        {empty ?? "Không có phim nào."}
      </div>
    );
  }
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {titles.map((title) => (
        <PosterCard key={title.id} title={title} layout="grid" />
      ))}
    </div>
  );
};

export default TitleGrid;
