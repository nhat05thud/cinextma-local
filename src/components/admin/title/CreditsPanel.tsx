"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete, AutocompleteItem, Avatar, Button, Card, CardBody, CardHeader, Input, Select, SelectItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { addCredit, moveCredit, removeCredit, searchPeople, updatePersonPhoto } from "@/actions/admin/titles";
import { mediaUrl } from "@/lib/media";
import type { TitleForEdit } from "@/server/queries/admin";
import { useAdminAction } from "../hooks";

const KINDS = [
  { key: "cast", label: "Diễn viên" },
  { key: "director", label: "Đạo diễn" },
  { key: "writer", label: "Biên kịch" },
];

type Credit = TitleForEdit["credits"][number];

const PersonPhoto: React.FC<{ credit: Credit }> = ({ credit }) => {
  const input = useRef<HTMLInputElement>(null);
  const { run } = useAdminAction();
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} title="Đổi ảnh">
        <Avatar src={credit.person.profile ?? undefined} name={credit.person.name} size="md" showFallback />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const form = new FormData();
          form.set("file", file);
          run(() => updatePersonPhoto(credit.person.id, form));
        }}
      />
    </>
  );
};

const CreditsPanel: React.FC<{ titleId: string; credits: Credit[] }> = ({ titleId, credits }) => {
  const { run, pending } = useAdminAction();
  const [kind, setKind] = useState("cast");
  const [name, setName] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [character, setCharacter] = useState("");
  const [options, setOptions] = useState<{ id: string; name: string; profilePath: string | null }[]>([]);

  useEffect(() => {
    if (name.trim().length < 2) return;
    const timer = setTimeout(async () => {
      const result = await searchPeople(name);
      if (result.success) setOptions(result.data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [name]);

  const add = () =>
    run(() => addCredit(titleId, { personId: personId ?? undefined, name, kind, character }), {
      onSuccess: () => {
        setName("");
        setPersonId(null);
        setCharacter("");
      },
    });

  return (
    <Card shadow="sm">
      <CardHeader className="font-semibold">Diễn viên & đoàn phim</CardHeader>
      <CardBody className="flex flex-col gap-5 pt-0">
        <div className="flex flex-wrap items-end gap-2">
          <Select size="sm" label="Vai trò" className="w-36" selectedKeys={[kind]} onSelectionChange={(k) => setKind(String(Array.from(k)[0] ?? "cast"))}>
            {KINDS.map((k) => (
              <SelectItem key={k.key}>{k.label}</SelectItem>
            ))}
          </Select>
          <Autocomplete
            size="sm"
            label="Tên (chọn người có sẵn hoặc gõ tên mới)"
            className="w-72"
            allowsCustomValue
            inputValue={name}
            onInputChange={(value) => {
              setName(value);
              setPersonId(null);
            }}
            onSelectionChange={(key) => {
              const person = options.find((o) => o.id === key);
              if (person) {
                setPersonId(person.id);
                setName(person.name);
              }
            }}
            items={name.trim().length < 2 ? [] : options}
          >
            {(person) => (
              <AutocompleteItem key={person.id} startContent={<Avatar size="sm" src={mediaUrl(person.profilePath) ?? undefined} name={person.name} />}>
                {person.name}
              </AutocompleteItem>
            )}
          </Autocomplete>
          {kind === "cast" && <Input size="sm" label="Vai diễn" className="w-48" value={character} onValueChange={setCharacter} />}
          <Button size="sm" color="primary" isDisabled={!name.trim()} isLoading={pending} onPress={add}>
            Thêm
          </Button>
        </div>

        {KINDS.map((k) => {
          const list = credits.filter((c) => c.kind === k.key);
          if (!list.length) return null;
          return (
            <div key={k.key} className="flex flex-col gap-2">
              <p className="text-foreground-500 text-sm font-medium">
                {k.label} ({list.length})
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((credit, index) => (
                  <div key={credit.id} className="bg-default-100 flex items-center gap-3 rounded-xl p-2">
                    <PersonPhoto credit={credit} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{credit.person.name}</p>
                      {credit.character && <p className="text-foreground-500 truncate text-xs">{credit.character}</p>}
                    </div>
                    <div className="flex shrink-0">
                      <Button isIconOnly size="sm" variant="light" isDisabled={index === 0} onPress={() => run(() => moveCredit(credit.id, -1))}>
                        <Icon icon="mdi:chevron-up" fontSize={18} />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" isDisabled={index === list.length - 1} onPress={() => run(() => moveCredit(credit.id, 1))}>
                        <Icon icon="mdi:chevron-down" fontSize={18} />
                      </Button>
                      <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => run(() => removeCredit(credit.id))}>
                        <Icon icon="mdi:close" fontSize={18} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {!credits.length && <p className="text-foreground-500 text-sm">Chưa có diễn viên. Dùng “Lấy thông tin từ TMDB” để điền tự động.</p>}
      </CardBody>
    </Card>
  );
};

export default CreditsPanel;
