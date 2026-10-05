@AGENTS.md

## ตรวจทุกรอบก่อนปล่อย (review round)

Every round, before asking the owner to merge an update to `main` (which makes it live), run the `review-round` skill (`.claude/skills/review-round/SKILL.md`). It runs 5 read-only reviewers in parallel (`.claude/agents/review-*.md`: Design, Mobile, States, Real user, Launch) and merges their findings into one Thai report. Fix verified high-priority issues caused by the update before asking to merge, and include the verdict line in the message to the owner.
