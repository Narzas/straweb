#!/usr/bin/env node
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs \"비번\"");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
console.log("\n.env.local (작은따옴표 필수 — $ 변수 치환 방지):");
console.log(`ADMIN_PASSWORD_HASH='${hash}'`);
console.log("\nVercel 환경변수 (따옴표 없이 그대로):");
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log("\nVercel: Production · Preview 둘 다 체크. Development는 체크 안 해도 됨.\n");
