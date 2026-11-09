import fs from "node:fs";
import path from "node:path";

const pairs = [
  ["licenses/HanziWriter-MIT.txt", "public/licenses/HanziWriter-MIT.txt"],
  ["licenses/ARPHICPL.txt", "public/licenses/ARPHICPL.txt"],
];

for (const [source, target] of pairs) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing required license: ${source}`);
  }
  const bytes = fs.readFileSync(source);
  if (bytes.length < 100) {
    throw new Error(`License looks truncated: ${source}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

console.log("Copied third-party licenses");
