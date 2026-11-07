/**
 * ส่งงานเข้าคิวทีละงาน งานถัดไปเริ่มเมื่องานก่อนหน้าเสร็จ (สำเร็จหรือพังก็ได้)
 * ใช้กับการบันทึกของแอดมิน: กดผลแล้วลงคู่ต่อไปทันที ต้องให้ "จบเกม" ถึงฐานข้อมูลก่อน "เริ่มเกม"
 * ไม่งั้นสองคำขอวิ่งพร้อมกัน เริ่มเกมใหม่อาจไปถึงก่อน แล้วชนกับเกมเดิมที่ยังไม่จบ (games_one_active_per_court)
 */
export function serial() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(job: () => Promise<T>): Promise<T> => {
    const p = tail.then(job);
    tail = p.catch(() => {});
    return p;
  };
}
