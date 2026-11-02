"use client";

import { useEffect, useState } from "react";
import { Autocomplete, AutocompleteItem, Button, Card, CardBody, CardHeader, Chip, Input, Switch } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  deleteCollection,
  moveCollection,
  saveCollection,
  searchTitlesForPicker,
  setCollectionItems,
} from "@/actions/admin/manage";
import { mediaUrl } from "@/lib/media";
import { useAdminAction } from "../hooks";

type Item = { id: string; title: string; type: string; poster: string | null };
type Collection = { id: string; name: string; active: boolean; items: Item[] };

const CollectionCard: React.FC<{ collection: Collection; first: boolean; last: boolean }> = ({ collection, first, last }) => {
  const { run, pending } = useAdminAction();
  const [name, setName] = useState(collection.name);
  const [items, setItems] = useState(collection.items);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Item[]>([]);
  const dirty = items.map((i) => i.id).join() !== collection.items.map((i) => i.id).join();

  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await searchTitlesForPicker(query);
      if (result.success) setOptions((result.data ?? []).map((t) => ({ id: t.id, title: t.title, type: t.type, poster: mediaUrl(t.posterPath) })));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const move = (index: number, dir: -1 | 1) =>
    setItems((all) => {
      const next = [...all];
      [next[index], next[index + dir]] = [next[index + dir], next[index]];
      return next;
    });

  return (
    <Card shadow="sm">
      <CardHeader className="flex flex-wrap items-center gap-2">
        <Input size="sm" value={name} onValueChange={setName} className="max-w-xs" aria-label="Tên hàng phim" />
        {name !== collection.name && (
          <Button size="sm" variant="flat" onPress={() => run(() => saveCollection({ id: collection.id, name }))}>
            Đổi tên
          </Button>
        )}
        <Switch size="sm" isSelected={collection.active} onValueChange={(v) => run(() => saveCollection({ id: collection.id, name: collection.name, active: v }))}>
          Hiển thị
        </Switch>
        <div className="ml-auto flex gap-1">
          <Button isIconOnly size="sm" variant="light" isDisabled={first} onPress={() => run(() => moveCollection(collection.id, -1))}>
            <Icon icon="mdi:arrow-up" />
          </Button>
          <Button isIconOnly size="sm" variant="light" isDisabled={last} onPress={() => run(() => moveCollection(collection.id, 1))}>
            <Icon icon="mdi:arrow-down" />
          </Button>
          <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => confirm(`Xoá "${collection.name}"?`) && run(() => deleteCollection(collection.id))}>
            <Icon icon="mdi:delete-outline" />
          </Button>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-3 pt-0">
        <Autocomplete
          size="sm"
          label="Thêm phim vào hàng"
          inputValue={query}
          onInputChange={setQuery}
          items={options.filter((o) => !items.some((i) => i.id === o.id))}
          onSelectionChange={(key) => {
            const item = options.find((o) => o.id === key);
            if (item) setItems((all) => [...all, item]);
            setQuery("");
          }}
        >
          {(o) => (
            <AutocompleteItem key={o.id} description={o.type === "tv" ? "Phim bộ" : "Phim lẻ"}>
              {o.title}
            </AutocompleteItem>
          )}
        </Autocomplete>
        <div className="flex flex-wrap gap-2">
          {items.map((item, i) => (
            <div key={item.id} className="bg-default-100 flex w-40 flex-col gap-1 rounded-lg p-1.5">
              <div className="bg-default-200 aspect-2/3 overflow-hidden rounded">
                {item.poster && <img src={item.poster} alt="" className="size-full object-cover" />}
              </div>
              <p className="truncate text-xs font-medium" title={item.title}>
                {item.title}
              </p>
              <div className="flex justify-between">
                <Button isIconOnly size="sm" variant="light" isDisabled={i === 0} onPress={() => move(i, -1)}>
                  <Icon icon="mdi:chevron-left" />
                </Button>
                <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => setItems((all) => all.filter((x) => x.id !== item.id))}>
                  <Icon icon="mdi:close" />
                </Button>
                <Button isIconOnly size="sm" variant="light" isDisabled={i === items.length - 1} onPress={() => move(i, 1)}>
                  <Icon icon="mdi:chevron-right" />
                </Button>
              </div>
            </div>
          ))}
          {!items.length && <p className="text-foreground-500 text-sm">Chưa có phim nào. Hàng trống sẽ không hiện trên trang chủ.</p>}
        </div>
        {dirty && (
          <div className="flex items-center gap-2">
            <Chip size="sm" color="warning" variant="flat">
              Chưa lưu
            </Chip>
            <Button size="sm" color="primary" isLoading={pending} onPress={() => run(() => setCollectionItems(collection.id, items.map((i) => i.id)))}>
              Lưu danh sách
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

const CollectionsManager: React.FC<{ collections: Collection[] }> = ({ collections }) => {
  const { run, pending } = useAdminAction();
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex max-w-lg gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveCollection({ name }), { onSuccess: () => setName("") });
        }}
      >
        <Input size="sm" placeholder="Tên hàng phim mới, ví dụ: Phim Tết 2027" value={name} onValueChange={setName} />
        <Button size="sm" type="submit" color="primary" isDisabled={!name.trim()} isLoading={pending}>
          Tạo
        </Button>
      </form>
      {collections.map((c, i) => (
        <CollectionCard key={c.id + c.items.map((x) => x.id).join()} collection={c} first={i === 0} last={i === collections.length - 1} />
      ))}
    </div>
  );
};

export default CollectionsManager;
