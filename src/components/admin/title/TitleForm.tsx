"use client";

import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  CheckboxGroup,
  Input,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { updateTitle, type TitleInput } from "@/actions/admin/titles";
import { AGE_RATINGS, COUNTRIES, QUALITIES } from "@/lib/catalog";
import type { TitleForEdit } from "@/server/queries/admin";
import { useAdminAction } from "../hooks";

type FormState = TitleForEdit["form"];

const TitleForm: React.FC<{ id: string; type: "movie" | "tv"; initial: FormState; genres: { id: string; name: string }[] }> = ({
  id,
  type,
  initial,
  genres,
}) => {
  const [form, setForm] = useState<FormState>(initial);
  const { run, pending } = useAdminAction();
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const num = (key: "year" | "runtime" | "totalEpisodes") => (value: string) =>
    set(key)(value === "" ? null : Number(value));
  const select = (key: "ageRating" | "quality" | "country" | "seriesStatus") => ({
    selectedKeys: form[key] ? [form[key] as string] : [],
    onSelectionChange: (keys: "all" | Set<React.Key>) => set(key)(String(Array.from(keys as Set<React.Key>)[0] ?? "")),
  });

  const save = () => run(() => updateTitle(id, form as unknown as TitleInput));

  return (
    <Card shadow="sm">
      <CardBody className="flex flex-col gap-5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Input isRequired label="Tên phim (tiếng Việt)" value={form.title} onValueChange={set("title")} />
          <Input label="Tên gốc" value={form.originalTitle} onValueChange={set("originalTitle")} />
          <Input
            label="Đường dẫn (slug)"
            value={form.slug}
            onValueChange={set("slug")}
            description={`/${type === "tv" ? "tv" : "movie"}/${form.slug || "..."}`}
          />
          <Input label="Khẩu hiệu (tagline)" value={form.tagline} onValueChange={set("tagline")} />
        </div>

        <Textarea label="Nội dung phim" minRows={4} value={form.overview} onValueChange={set("overview")} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input type="date" label="Ngày khởi chiếu" value={form.releaseDate} onValueChange={set("releaseDate")} />
          <Input type="number" label="Năm" value={form.year?.toString() ?? ""} onValueChange={num("year")} />
          <Input
            type="number"
            label={type === "tv" ? "Thời lượng mỗi tập (phút)" : "Thời lượng (phút)"}
            value={form.runtime?.toString() ?? ""}
            onValueChange={num("runtime")}
            description="Tự điền khi video xử lý xong"
          />
          <Select label="Phân loại độ tuổi" {...select("ageRating")}>
            {AGE_RATINGS.map((r) => (
              <SelectItem key={r.value}>{r.label}</SelectItem>
            ))}
          </Select>
          <Select label="Chất lượng (nhãn)" {...select("quality")}>
            {QUALITIES.map((q) => (
              <SelectItem key={q}>{q}</SelectItem>
            ))}
          </Select>
          <Select label="Quốc gia" {...select("country")}>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code}>{c.name}</SelectItem>
            ))}
          </Select>
          <Input
            type="number"
            step="0.1"
            min={0}
            max={10}
            label="Điểm đánh giá (0-10)"
            value={String(form.rating ?? 0)}
            onValueChange={(v) => set("rating")(Number(v))}
          />
          <Input type="number" label="Số lượt đánh giá" value={String(form.voteCount ?? 0)} onValueChange={(v) => set("voteCount")(Number(v))} />
          {type === "tv" && (
            <>
              <Select label="Trạng thái phim bộ" {...select("seriesStatus")}>
                <SelectItem key="ongoing">Đang cập nhật</SelectItem>
                <SelectItem key="completed">Hoàn tất</SelectItem>
              </Select>
              <Input
                type="number"
                label="Tổng số tập dự kiến"
                value={form.totalEpisodes?.toString() ?? ""}
                onValueChange={num("totalEpisodes")}
              />
            </>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Trailer (link YouTube)"
            value={form.trailerUrl}
            onValueChange={set("trailerUrl")}
            startContent={<Icon icon="mdi:youtube" className="text-danger" fontSize={20} />}
          />
          <Input label="IMDb ID" value={form.imdbId} onValueChange={set("imdbId")} placeholder="tt1234567" />
        </div>

        <CheckboxGroup
          label="Thể loại"
          orientation="horizontal"
          value={form.genreIds}
          onValueChange={set("genreIds")}
          classNames={{ wrapper: "gap-x-4 gap-y-2" }}
        >
          {genres.map((g) => (
            <Checkbox key={g.id} value={g.id} size="sm">
              {g.name}
            </Checkbox>
          ))}
        </CheckboxGroup>

        <div className="flex justify-end">
          <Button color="primary" variant="shadow" isLoading={pending} onPress={save} startContent={!pending && <Icon icon="mdi:content-save" fontSize={20} />}>
            Lưu thông tin
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

export default TitleForm;
