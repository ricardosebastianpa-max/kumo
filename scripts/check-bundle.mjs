// Fails CI when any route's first-load JS exceeds the budget (spec §0.5.4: < 170 KB).
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
const BUDGET = 170 * 1024;
const manifest = JSON.parse(readFileSync(".next/app-build-manifest.json", "utf8"));
let worst = ["", 0];
for (const [route, files] of Object.entries(manifest.pages)) {
  const size = files.filter((f) => f.endsWith(".js")).map((f) => `.next/${f}`).filter(existsSync)
    .reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
  if (size > worst[1]) worst = [route, size];
  if (size > BUDGET) { console.error(`✗ ${route}: ${(size / 1024).toFixed(1)} KB > 170 KB`); process.exitCode = 1; }
}
console.log(`largest route ${worst[0]}: ${(worst[1] / 1024).toFixed(1)} KB gzip (budget 170 KB)`);
