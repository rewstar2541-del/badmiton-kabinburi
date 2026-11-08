-- โหมดจัดคนลงสนามอัตโนมัติ: เปิด (ค่าเดิม) = ระบบจัดคิวรวมขึ้นรอทุกสนาม, ปิด = แอดมินจัดเอง
alter table public.settings add column if not exists auto_assign boolean not null default true;
