-- ส่งผลเข้าสู่ระบบด้วย LINE ต่อให้แอพบนหน้าจอหลักของ iPhone
-- (แอพบนหน้าจอหลักกับ Safari เก็บข้อมูลแยกกัน LINE อาจส่งกลับไปเปิดใน Safari แทนแอพ)
-- เก็บผลไว้ใต้ hash ของ state 10 นาที ใช้ได้ครั้งเดียว อ่านเขียนได้เฉพาะ edge function line-login (service role)
create table if not exists public.line_handoffs (
  state_hash text primary key,
  result jsonb not null,
  expires_at timestamptz not null default (now() + interval '10 minutes')
);
alter table public.line_handoffs enable row level security;
revoke all on public.line_handoffs from anon, authenticated;
