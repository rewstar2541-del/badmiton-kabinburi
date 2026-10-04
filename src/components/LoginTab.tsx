"use client";

import { useStore } from "@/lib/store";
import { AdminsCard } from "./AdminsCard";
import { Button, Card, SectionTitle } from "./ui";
import { t } from "@/lib/i18n";

/** บัญชีของแอดมิน (เข้าด้วย LINE) ในหน้าตั้งค่า: ออกจากระบบ และรายชื่อแอดมิน */
export function LoginTab() {
  const { auth } = useStore();
  if (!auth.email) return null;
  return (
    <div className="space-y-4">
      <SectionTitle>{t("บัญชีแอดมิน")}</SectionTitle>
      <Card className="space-y-3 text-center">
        <p className="text-sm">{t("เข้าสู่ระบบด้วย LINE แล้ว")}</p>
        <Button className="w-full" onClick={() => auth.signOut()}>
          {t("ออกจากระบบ")}
        </Button>
      </Card>
      {auth.isAdmin && <AdminsCard />}
    </div>
  );
}
