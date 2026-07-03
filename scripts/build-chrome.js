const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);
const version = manifest.version || "0.1.0";
const outFile = path.join(distDir, `ratpack-${version}-chrome.zip`);

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

const excludes = [
  "node_modules",
  "dist",
  ".git",
  "scripts",
  "notes",
  "docs",
  ".gitignore",
  "package-lock.json",
  "AGENTS.md",
].map((e) => `-x "*${e}*"`).join(" ");

execSync(`cd "${root}" && zip -r "${outFile}" . ${excludes}`, {
  stdio: "pipe",
});

const size = fs.statSync(outFile).size;
console.log(
  `Chrome package: dist/${path.basename(outFile)} (${(size / 1024).toFixed(1)} KB)`
);
