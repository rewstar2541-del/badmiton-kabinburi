-- โหมดรอสนามเดิม: เปิด = คู่ที่ขึ้นรอสนามไหนแล้วรอสนามนั้น ไม่โยกไปสนามที่จบก่อน, ปิด (ค่าเดิม) = สนามไหนจบก่อนได้คู่แรก
alter table public.settings add column if not exists fixed_court boolean not null default false;
