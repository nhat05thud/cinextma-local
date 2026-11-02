"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToast, Button, Card, CardBody, CardHeader, Input, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { authClient } from "@/lib/auth-client";
import PasswordInput from "@/components/ui/input/PasswordInput";
import BrandLogo from "@/components/ui/other/BrandLogo";
import { LockPassword, Mail, User } from "@/utils/icons";

const translateError = (message?: string) => {
  if (!message) return "Đã có lỗi xảy ra, vui lòng thử lại";
  const map: Record<string, string> = {
    "Invalid email or password": "Email hoặc mật khẩu không đúng",
    "User already exists": "Email này đã được đăng ký",
    "User already exists. Use another email.": "Email này đã được đăng ký",
    "Password too short": "Mật khẩu phải có ít nhất 8 ký tự",
    "Invalid email": "Email không hợp lệ",
    "Email and password sign up is not enabled": "Đăng ký tài khoản đang tạm tắt",
    "You have been banned from this application": "Tài khoản của bạn đã bị khoá",
  };
  return map[message] ?? message;
};

const AuthForm: React.FC<{ next: string; allowSignup: boolean }> = ({ next, allowSignup }) => {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const result =
      tab === "login"
        ? await authClient.signIn.email({ email: form.email, password: form.password })
        : await authClient.signUp.email({ name: form.name || form.email.split("@")[0], email: form.email, password: form.password });
    setLoading(false);

    if (result.error) {
      addToast({ title: translateError(result.error.message), color: "danger" });
      return;
    }
    addToast({ title: tab === "login" ? "Đăng nhập thành công" : "Tạo tài khoản thành công", color: "success" });
    router.push(next);
    router.refresh();
  };

  return (
    <Card className="bg-background/80 w-full max-w-md backdrop-blur-xl" shadow="lg">
      <CardHeader className="flex flex-col items-center gap-2 pt-8">
        <BrandLogo animate />
        <p className="text-foreground-500 text-sm">
          {tab === "login" ? "Đăng nhập để tiếp tục xem phim" : "Tạo tài khoản để lưu phim và lịch sử xem"}
        </p>
      </CardHeader>
      <CardBody className="px-6 pb-8">
        {allowSignup && (
          <Tabs
            fullWidth
            selectedKey={tab}
            onSelectionChange={(key) => setTab(key as "login" | "register")}
            className="mb-4"
          >
            <Tab key="login" title="Đăng nhập" />
            <Tab key="register" title="Đăng ký" />
          </Tabs>
        )}
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {tab === "register" && (
            <Input
              label="Tên hiển thị"
              variant="underlined"
              value={form.name}
              onValueChange={set("name")}
              startContent={<User className="text-lg" />}
              isDisabled={loading}
            />
          )}
          <Input
            isRequired
            type="email"
            label="Email"
            variant="underlined"
            autoComplete="email"
            value={form.email}
            onValueChange={set("email")}
            startContent={<Mail className="text-xl" />}
            isDisabled={loading}
          />
          {tab === "register" ? (
            <PasswordInput
              isRequired
              withStrengthMeter
              label="Mật khẩu"
              variant="underlined"
              value={form.password}
              onValueChange={set("password")}
              startContent={<LockPassword className="text-xl" />}
              isDisabled={loading}
            />
          ) : (
            <PasswordInput
              isRequired
              label="Mật khẩu"
              variant="underlined"
              autoComplete="current-password"
              value={form.password}
              onValueChange={set("password")}
              startContent={<LockPassword className="text-xl" />}
              isDisabled={loading}
            />
          )}
          <Button
            type="submit"
            color="primary"
            variant="shadow"
            className="mt-2"
            isLoading={loading}
            startContent={!loading && <Icon icon={tab === "login" ? "mdi:login" : "mdi:account-plus"} fontSize={20} />}
          >
            {tab === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </Button>
          {!allowSignup && (
            <p className="text-foreground-500 text-center text-xs">Liên hệ quản trị viên để được cấp tài khoản.</p>
          )}
        </form>
      </CardBody>
    </Card>
  );
};

export default AuthForm;
