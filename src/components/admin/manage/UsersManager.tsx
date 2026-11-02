"use client";

import { useState } from "react";
import {
  Button,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  User,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { createUser, deleteUser, resetUserPassword, setUserBanned, setUserRole } from "@/actions/admin/manage";
import { formatDate } from "@/lib/format";
import { useAdminAction } from "../hooks";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  createdAt: string;
  histories: number;
  watchlist: number;
};

const CreateUserModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { run, pending } = useAdminAction();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as "user" | "admin" });
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Tạo tài khoản</ModalHeader>
        <ModalBody>
          <Input label="Tên" value={form.name} onValueChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Input isRequired type="email" label="Email" value={form.email} onValueChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <Input isRequired label="Mật khẩu (>= 8 ký tự)" value={form.password} onValueChange={(v) => setForm((f) => ({ ...f, password: v }))} />
          <Select label="Quyền" selectedKeys={[form.role]} onSelectionChange={(k) => setForm((f) => ({ ...f, role: String(Array.from(k)[0]) as "user" | "admin" }))}>
            <SelectItem key="user">Người xem</SelectItem>
            <SelectItem key="admin">Quản trị viên</SelectItem>
          </Select>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Huỷ
          </Button>
          <Button color="primary" isLoading={pending} onPress={() => run(() => createUser(form), { onSuccess: onClose })}>
            Tạo
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const UsersManager: React.FC<{ users: UserRow[]; currentUserId: string }> = ({ users, currentUserId }) => {
  const { run } = useAdminAction();
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()));

  const onAction = (user: UserRow, key: string) => {
    if (key === "role") run(() => setUserRole(user.id, user.role === "admin" ? "user" : "admin"));
    if (key === "ban") run(() => setUserBanned(user.id, !user.banned));
    if (key === "password") {
      const password = prompt(`Mật khẩu mới cho ${user.email} (>= 8 ký tự):`);
      if (password) run(() => resetUserPassword(user.id, password));
    }
    if (key === "delete" && confirm(`Xoá tài khoản ${user.email}? Lịch sử xem và danh sách phim của họ cũng bị xoá.`)) {
      run(() => deleteUser(user.id));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input size="sm" className="max-w-xs" placeholder="Tìm theo tên, email..." value={q} onValueChange={setQ} startContent={<Icon icon="mdi:magnify" />} />
        <Button size="sm" color="primary" className="ml-auto" onPress={() => setCreateOpen(true)} startContent={<Icon icon="mdi:account-plus" />}>
          Tạo tài khoản
        </Button>
      </div>
      <Table aria-label="Người dùng" isStriped>
        <TableHeader>
          <TableColumn>NGƯỜI DÙNG</TableColumn>
          <TableColumn>QUYỀN</TableColumn>
          <TableColumn>HOẠT ĐỘNG</TableColumn>
          <TableColumn>NGÀY TẠO</TableColumn>
          <TableColumn align="end">THAO TÁC</TableColumn>
        </TableHeader>
        <TableBody emptyContent="Không có người dùng.">
          {filtered.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <User name={u.name} description={u.email} avatarProps={{ name: u.name, size: "sm" }} />
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Chip size="sm" variant="flat" color={u.role === "admin" ? "warning" : "default"}>
                    {u.role === "admin" ? "Admin" : "Người xem"}
                  </Chip>
                  {u.banned && (
                    <Chip size="sm" variant="flat" color="danger">
                      Đã khoá
                    </Chip>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-foreground-500 text-xs">
                  {u.histories} lượt xem • {u.watchlist} phim đã lưu
                </span>
              </TableCell>
              <TableCell>
                <span className="text-xs">{formatDate(u.createdAt)}</span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Dropdown>
                    <DropdownTrigger>
                      <Button isIconOnly size="sm" variant="light">
                        <Icon icon="mdi:dots-vertical" fontSize={18} />
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Thao tác"
                      disabledKeys={u.id === currentUserId ? ["role", "ban", "delete"] : []}
                      onAction={(key) => onAction(u, String(key))}
                    >
                      <DropdownItem key="role">{u.role === "admin" ? "Bỏ quyền admin" : "Cấp quyền admin"}</DropdownItem>
                      <DropdownItem key="password">Đặt lại mật khẩu</DropdownItem>
                      <DropdownItem key="ban">{u.banned ? "Mở khoá tài khoản" : "Khoá tài khoản"}</DropdownItem>
                      <DropdownItem key="delete" color="danger" className="text-danger">
                        Xoá tài khoản
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CreateUserModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default UsersManager;
