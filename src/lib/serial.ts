/**
 * ส่งงานเข้าคิวทีละงาน งานถัดไปเริ่มเมื่องานก่อนหน้าเสร็จ (สำเร็จหรือพังก็ได้)
 * ใช้กับการบันทึกของแอดมิน: กดผลแล้วลงคู่ต่อไปทันที ต้องให้ "จบเกม" ถึงฐานข้อมูลก่อน "เริ่มเกม"
 * ไม่งั้นสองคำขอวิ่งพร้อมกัน เริ่มเกมใหม่อาจไปถึงก่อน แล้วชนกับเกมเดิมที่ยังไม่จบ (games_one_active_per_court)
 */
export function serial(maxWait = 15000) {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const p = tail.then(job);
    // คำขอค้าง (เน็ตหลุดแต่ไม่ error) ไม่ให้ขวางการบันทึกถัดไปตลอดไป รอได้ไม่เกิน maxWait แล้วคิวเดินต่อ
    tail = Promise.race([p, new Promise((r) => setTimeout(r, maxWait))]).catch(() => {});
    return p;
  };
}
