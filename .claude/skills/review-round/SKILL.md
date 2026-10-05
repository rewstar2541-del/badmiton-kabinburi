---
name: review-round
description: Run the 5 read-only reviewers (Design, Mobile, States, Real user, Launch) in parallel on the badminton app and merge them into one prioritized Thai report. Run every round before asking the owner to merge an update to main.
---

# Review round (ตรวจ 5 ด้านก่อนปล่อย)

Run this every round, after the change is committed on its branch and before asking the owner to merge to `main` (merging = going live on Vercel).

## Steps

1. **Scope.** Get the changed files: `git diff --name-only origin/main...HEAD`. If the owner asked for a full check, or there is no diff, scope = "whole app" (`src/`, `supabase/`).
2. **Run the checks** (the reviewers are read-only and cannot run commands):
   `npm ci` if `node_modules` is missing, then `npm run lint`, `npx next typegen && npx tsc --noEmit` (typegen creates the `LayoutProps`/`PageProps` types; tsc fails without it on a fresh clone), `npm test`, `npm run build`. Keep only pass/fail plus the first ~20 lines of each failure.
3. **Fan out in parallel** — one message, five Agent calls, with `subagent_type`:
   `review-design`, `review-mobile`, `review-states`, `review-real-user`, `review-launch`.
   Give each: the scope (file list or "whole app"), a one-line summary of what the update does, and (Launch only) the check results from step 2. Tell them they are read-only.
4. **Merge** the five reports into one Thai report:
   - Drop duplicates (same file/line or same issue from two reviewers: keep one, note both areas).
   - Verify every [สูง] item yourself by opening the cited file:line. Drop it if it is wrong.
   - Sort: สูง → กลาง → ต่ำ. Keep at most ~10 items total; put the rest under "เล็กน้อย".
   - Write it in plain Thai for a non-programmer: what the user would see, not code jargon.
5. **Decide.**
   - Any verified [สูง] item caused by this update → fix it, commit, and re-run only the reviewers whose area it touched.
   - [สูง] items that existed before this update → list them for the owner; don't widen the change without asking.
   - Then report: verdict line (ปล่อยได้ / ปล่อยได้แต่ควรแก้ / ยังไม่ควรปล่อย) + the merged list.
6. Save the full report to `/mnt/project-files/reviews/YYYY-MM-DD-<branch>.md` when that folder exists, and attach it; the chat reply stays short (verdict + top items).

## Report shape

```
ผลตรวจ 5 ด้าน: <คำตัดสิน>
ผลเช็คอัตโนมัติ: lint ✓ · types ✓ · test ✓ · build ✓

ต้องแก้ก่อนปล่อย
1. [Mobile] ...
ควรแก้
...
เล็กน้อย
...
```

Rules: reviewers never edit files; nothing in the round may cost money (no paid services, no sending LINE messages); don't propose reordering pages (owner chose to keep the current layout).
