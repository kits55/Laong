#!/bin/sh
# ส่งโค้ดขึ้น branch vite-app บน GitHub โดยวางทุกไฟล์ไว้ใต้โฟลเดอร์ Laong/
# เพราะโปรเจกต์ Vercel "laong" ตั้ง Root Directory = Laong (ใช้ร่วมกับ main ที่เป็น Next.js)
# ในเครื่องยังเป็นโครงเดิม ไม่ต้องย้ายไฟล์
set -e
cd "$(dirname "$0")/.."
REMOTE=${REMOTE:-origin}
git fetch -q "$REMOTE" vite-app
inner=$(git rev-parse HEAD^{tree})
outer=$(printf '040000 tree %s\tLaong\n' "$inner" | git mktree)
msg=$(git log -1 --format=%B HEAD)
commit=$(printf '%s\n' "$msg" | git commit-tree "$outer" -p FETCH_HEAD)
git push "$REMOTE" "$commit:refs/heads/vite-app"
echo "pushed $commit (tree Laong/ = $(git rev-parse --short HEAD))"
