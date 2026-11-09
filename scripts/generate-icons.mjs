import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const output = path.resolve("public/icons");
fs.mkdirSync(output, { recursive: true });

const svg = (maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="1024" height="1024" rx="${maskable ? 0 : 220}" fill="#FBE8EC"/>
  <circle cx="512" cy="570" r="285" fill="#FFF9F7" stroke="#7B4051" stroke-width="32"/>
  <path d="M286 400 L330 150 L470 310 M738 400 L694 150 L554 310"
        fill="#FFF9F7" stroke="#7B4051" stroke-width="32" stroke-linejoin="round"/>
  <circle cx="415" cy="540" r="24" fill="#7B4051"/>
  <circle cx="609" cy="540" r="24" fill="#7B4051"/>
  <path d="M475 650 Q512 690 549 650" fill="none" stroke="#D96C8A" stroke-width="24"
        stroke-linecap="round"/>
  <path d="M585 355 Q655 300 715 365 Q655 430 585 355" fill="#D96C8A"/>
  <circle cx="650" cy="365" r="25" fill="#D96C8A"/>
</svg>`;

async function write(size, filename, maskable = false) {
  await sharp(Buffer.from(svg(maskable)))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, filename));
}

await Promise.all([
  write(180, "apple-touch-icon.png"),
  write(192, "pwa-192.png"),
  write(512, "pwa-512.png"),
  write(512, "maskable-512.png", true),
]);
console.log("Generated PWA icons");
