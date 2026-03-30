const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
const distDir = path.join(publicDir, "dist");

const copies = [
  { from: path.join(publicDir, "css", "barcode.css"), to: path.join(distDir, "css", "barcode.css") },
  { from: path.join(publicDir, "css", "login.css"), to: path.join(distDir, "css", "login.css") },
  { from: path.join(publicDir, "js", "barcode.js"), to: path.join(distDir, "js", "barcode.js") }
];

fs.mkdirSync(path.join(distDir, "css"), { recursive: true });
fs.mkdirSync(path.join(distDir, "js"), { recursive: true });

for (const item of copies) {
  fs.copyFileSync(item.from, item.to);
}

console.log("Dist assets synced to public/dist.");
