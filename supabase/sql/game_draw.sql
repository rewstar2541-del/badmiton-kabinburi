-- ผลเสมอ: เกมที่จบโดยไม่มีทีมชนะ (นับว่าเล่นแล้ว ไม่นับแพ้ชนะ)
alter table public.games add column if not exists draw boolean not null default false;
