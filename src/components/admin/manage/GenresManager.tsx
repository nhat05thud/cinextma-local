"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input } from "@heroui/react";
import { Icon } from "@iconify/react";
import { deleteGenre, moveGenre, saveGenre } from "@/actions/admin/manage";
import { useAdminAction } from "../hooks";

type Genre = { id: string; name: string; slug: string; count: number };

const GenreRow: React.FC<{ genre: Genre; first: boolean; last: boolean }> = ({ genre, first, last }) => {
  const { run, pending } = useAdminAction();
  const [name, setName] = useState(genre.name);
  return (
    <div className="bg-default-100 flex items-center gap-2 rounded-xl p-2">
      <Input size="sm" value={name} onValueChange={setName} className="flex-1" aria-label="Tên thể loại" />
      <span className="text-foreground-500 w-20 shrink-0 text-right text-xs">{genre.count} phim</span>
      <Button size="sm" variant="flat" isDisabled={name === genre.name || !name.trim()} isLoading={pending} onPress={() => run(() => saveGenre({ id: genre.id, name }))}>
        Lưu
      </Button>
      <Button isIconOnly size="sm" variant="light" isDisabled={first} onPress={() => run(() => moveGenre(genre.id, -1))}>
        <Icon icon="mdi:chevron-up" fontSize={18} />
      </Button>
      <Button isIconOnly size="sm" variant="light" isDisabled={last} onPress={() => run(() => moveGenre(genre.id, 1))}>
        <Icon icon="mdi:chevron-down" fontSize={18} />
      </Button>
      <Button
        isIconOnly
        size="sm"
        variant="light"
        color="danger"
        onPress={() => confirm(`Xoá thể loại "${genre.name}"? Phim thuộc thể loại này không bị xoá.`) && run(() => deleteGenre(genre.id))}
      >
        <Icon icon="mdi:delete-outline" fontSize={18} />
      </Button>
    </div>
  );
};

const GenresManager: React.FC<{ genres: Genre[] }> = ({ genres }) => {
  const { run, pending } = useAdminAction();
  const [name, setName] = useState("");
  return (
    <Card shadow="sm">
      <CardBody className="flex flex-col gap-3 p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveGenre({ name }), { onSuccess: () => setName("") });
          }}
        >
          <Input size="sm" placeholder="Tên thể loại mới..." value={name} onValueChange={setName} />
          <Button size="sm" type="submit" color="primary" isDisabled={!name.trim()} isLoading={pending}>
            Thêm
          </Button>
        </form>
        <div className="flex flex-col gap-2">
          {genres.map((g, i) => (
            <GenreRow key={`${g.id}-${g.name}`} genre={g} first={i === 0} last={i === genres.length - 1} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
};

export default GenresManager;
