-- ช่องทางรับเงิน: เปิด/ปิด PromptPay และบัญชีธนาคารแยกกัน (ปิดแล้วเลขเดิมยังเก็บไว้)
alter table public.settings add column if not exists promptpay_on boolean not null default true;
alter table public.settings add column if not exists bank_on boolean not null default true;
