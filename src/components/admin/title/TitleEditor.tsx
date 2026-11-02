"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Switch,
  Tab,
  Tabs,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { parseAsString, useQueryState } from "nuqs";
import { bumpTitle, deleteTitle, setTitleStatus, toggleFeatured, updateFromTmdb } from "@/actions/admin/titles";
import type { TitleForEdit } from "@/server/queries/admin";
import { useAdminAction } from "../hooks";
import VideoPanel from "../video/VideoPanel";
import VideoUploader from "../video/VideoUploader";
import CreditsPanel from "./CreditsPanel";
import EpisodesPanel from "./EpisodesPanel";
import ImagesPanel from "./ImagesPanel";
import TitleForm from "./TitleForm";
import TmdbSearch from "./TmdbSearch";
import RemoteImport from "./RemoteImport";

const TitleEditor: React.FC<{ data: TitleForEdit; genres: { id: string; name: string }[] }> = ({ data, genres }) => {
  const router = useRouter();
  const { run, pending } = useAdminAction();
  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("info"));
  const [tmdbOpen, setTmdbOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteVideos, setDeleteVideos] = useState(true);
  const tv = data.type === "tv";
  const publicHref = `/${tv ? "tv" : "movie"}/${data.slug}`;
  const hasFrames = !!data.video?.frames.length || data.seasons.some((s) => s.episodes.some((e) => e.video?.frames.length));

  const episodeCount = data.seasons.reduce((n, s) => n + s.episodes.length, 0);
  const readyEpisodes = data.seasons.reduce((n, s) => n + s.episodes.filter((e) => e.video?.status === "ready").length, 0);
  const checklist = [
    { ok: tv ? readyEpisodes > 0 : data.video?.status === "ready", label: tv ? "Có ít nhất 1 tập sẵn sàng" : "Video đã xử lý xong" },
    { ok: !!data.images.poster, label: "Có poster" },
    { ok: !!data.images.backdrop, label: "Có ảnh nền" },
    { ok: !!data.form.overview, label: "Có nội dung phim" },
    { ok: data.form.genreIds.length > 0, label: "Có thể loại" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card shadow="sm">
        <CardBody className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="bg-default-100 aspect-2/3 w-16 shrink-0 overflow-hidden rounded-lg">
              {data.images.poster && <img src={data.images.poster} alt="" className="size-full object-cover" />}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Chip size="sm" variant="flat" color={tv ? "warning" : "primary"}>
                  {tv ? "Phim bộ" : "Phim lẻ"}
                </Chip>
                <Chip size="sm" variant="dot" color={data.status === "published" ? "success" : "default"}>
                  {data.status === "published" ? "Đã xuất bản" : "Bản nháp"}
                </Chip>
                {tv && (
                  <Chip size="sm" variant="flat">
                    {readyEpisodes}/{episodeCount} tập sẵn sàng
                  </Chip>
                )}
                <Chip size="sm" variant="flat" startContent={<Icon icon="mdi:eye" className="ml-1" />}>
                  {data.viewCount} lượt xem
                </Chip>
              </div>
              <h1 className="mt-1 truncate text-xl font-bold md:text-2xl">{data.form.title}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              size="sm"
              color="success"
              isSelected={data.status === "published"}
              onValueChange={(v) => run(() => setTitleStatus(data.id, v ? "published" : "draft"))}
            >
              Xuất bản
            </Switch>
            <Switch size="sm" color="warning" isSelected={data.featured} onValueChange={(v) => run(() => toggleFeatured(data.id, v))}>
              Banner trang chủ
            </Switch>
            <Button as={Link} href={publicHref} target="_blank" size="sm" variant="flat" startContent={<Icon icon="mdi:open-in-new" />}>
              Xem
            </Button>
            <Dropdown>
              <DropdownTrigger>
                <Button size="sm" variant="flat" isIconOnly isLoading={pending}>
                  <Icon icon="mdi:dots-vertical" fontSize={20} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Thao tác"
                onAction={(key) => {
                  if (key === "tmdb") setTmdbOpen(true);
                  if (key === "remote") setRemoteOpen(true);
                  if (key === "bump") run(() => bumpTitle(data.id));
                  if (key === "delete") setDeleteOpen(true);
                }}
              >
                <DropdownItem
                  key="remote"
                  startContent={<Icon icon="mdi:cloud-download" />}
                  description={tv ? "Thêm tập từ YouTube, playlist, link .mp4..." : "Thay video bằng video từ link"}
                >
                  Lấy video từ link
                </DropdownItem>
                <DropdownItem key="tmdb" startContent={<Icon icon="simple-icons:themoviedatabase" />}>
                  Lấy thông tin từ TMDB
                </DropdownItem>
                <DropdownItem key="bump" startContent={<Icon icon="mdi:arrow-up-bold-box-outline" />} description="Ví dụ khi vừa thêm tập mới">
                  Đưa lên đầu “Mới cập nhật”
                </DropdownItem>
                <DropdownItem key="delete" color="danger" className="text-danger" startContent={<Icon icon="mdi:delete" />}>
                  Xoá phim
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </CardBody>
        {data.status !== "published" && (
          <div className="border-divider flex flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 text-sm">
            <span className="text-foreground-500">Trước khi xuất bản:</span>
            {checklist.map((c) => (
              <span key={c.label} className={c.ok ? "text-success" : "text-foreground-500"}>
                <Icon icon={c.ok ? "mdi:check-circle" : "mdi:circle-outline"} className="mr-1 inline" />
                {c.label}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} variant="underlined" color="primary" size="lg">
        <Tab key="info" title="Thông tin">
          <TitleForm id={data.id} type={data.type} initial={data.form} genres={genres} />
        </Tab>
        <Tab key="images" title="Ảnh bìa">
          <ImagesPanel titleId={data.id} images={data.images} hasFrames={hasFrames} />
        </Tab>
        {tv ? (
          <Tab key="episodes" title={`Tập phim (${episodeCount})`}>
            <EpisodesPanel titleId={data.id} titleName={data.form.title} seasons={data.seasons} />
          </Tab>
        ) : (
          <Tab key="video" title={data.video ? "Video" : "Tải video lên"}>
            <div className="flex flex-col gap-4">
              {data.video && <VideoPanel video={data.video} target={{ kind: "movie", titleId: data.id }} />}
              <Card shadow="sm">
                <CardHeader className="font-semibold">{data.video ? "Thay video khác" : "Tải video phim lên"}</CardHeader>
                <CardBody className="pt-0">
                  <VideoUploader
                    kind="movie"
                    replacing={!!data.video}
                    target={{ targetType: "title", targetId: data.id }}
                    label={data.form.title}
                  />
                </CardBody>
              </Card>
            </div>
          </Tab>
        )}
        <Tab key="credits" title="Diễn viên">
          <CreditsPanel titleId={data.id} credits={data.credits} />
        </Tab>
      </Tabs>

      <Modal isOpen={remoteOpen} onClose={() => setRemoteOpen(false)} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Lấy video từ link</ModalHeader>
          <ModalBody className="pb-6">
            <RemoteImport
              target={{ titleId: data.id, type: data.type, title: data.form.title }}
              onDone={() => {
                setRemoteOpen(false);
                setTab(tv ? "episodes" : "video");
              }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={tmdbOpen} onClose={() => setTmdbOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>Lấy thông tin từ TMDB</ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-foreground-500 text-sm">
              Điền tự động nội dung, thể loại, diễn viên, đạo diễn, trailer, điểm đánh giá{tv ? ", danh sách phần/tập" : ""}. Video đã upload được giữ nguyên.
            </p>
            <TmdbSearch
              type={data.type}
              initialQuery={data.form.originalTitle || data.form.title}
              actionLabel="Dùng"
              showReplaceImages
              onPick={(item, replaceImages) =>
                run(() => updateFromTmdb(data.id, item.id, replaceImages), { onSuccess: () => setTmdbOpen(false) }).then(() => router.refresh())
              }
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <ModalContent>
          <ModalHeader>Xoá “{data.form.title}”?</ModalHeader>
          <ModalBody>
            <p>Phim, ảnh bìa{tv ? ", toàn bộ phần/tập" : ""} và lịch sử xem liên quan sẽ bị xoá vĩnh viễn.</p>
            <Checkbox isSelected={deleteVideos} onValueChange={setDeleteVideos}>
              Xoá luôn file video (giải phóng dung lượng)
            </Checkbox>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeleteOpen(false)}>
              Huỷ
            </Button>
            <Button
              color="danger"
              isLoading={pending}
              onPress={() => run(() => deleteTitle(data.id, deleteVideos), { refresh: false, onSuccess: () => router.push("/admin/titles") })}
            >
              Xoá phim
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default TitleEditor;
