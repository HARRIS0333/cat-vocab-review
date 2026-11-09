import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const requiredFiles = [
  "index.html",
  "content.json",
  "manifest.webmanifest",
  "sw.js",
  "licenses/HanziWriter-MIT.txt",
  "licenses/ARPHICPL.txt",
];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(dist, file))) throw new Error(`missing dist/${file}`);
}

const content = JSON.parse(fs.readFileSync(path.join(dist, "content.json"), "utf8"));
if (content.groups.length !== 31) throw new Error("expected 31 groups");
const chars = fs.readdirSync(path.join(dist, "characters"))
  .filter((name) => name.endsWith(".json") && name !== "index.json");
if (chars.length !== 413) throw new Error(`expected 413 character files, got ${chars.length}`);
if (content.counts.readingItems !== 265 || content.counts.writingItems !== 250) {
  throw new Error("content counts changed");
}

const sw = fs.readFileSync(path.join(dist, "sw.js"), "utf8");
const precacheUrls = new Set(
  [...sw.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]),
);
const requiredPrecache = [
  "index.html",
  "content.json",
  "manifest.webmanifest",
  "characters/index.json",
  "licenses/HanziWriter-MIT.txt",
  "licenses/ARPHICPL.txt",
];
for (const file of requiredPrecache) {
  if (!precacheUrls.has(file)) {
    throw new Error(`service worker does not precache ${file}`);
  }
}
for (const file of chars) {
  if (!precacheUrls.has(`characters/${file}`)) {
    throw new Error(`service worker does not precache characters/${file}`);
  }
}

const basePath = (process.env.VITE_BASE_PATH ?? "/").replace(/\/?$/, "/");
const indexHtml = fs.readFileSync(path.join(dist, "index.html"), "utf8");
for (const asset of [`${basePath}assets/`, `${basePath}manifest.webmanifest`]) {
  if (!indexHtml.includes(asset)) throw new Error(`index.html does not use ${asset}`);
}

console.log(
  `Verified dist: ${content.groups.length} groups, ${chars.length} characters, base ${basePath}`,
);
