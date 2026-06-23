import { readFileSync } from "node:fs";
import { join } from "node:path";

const tagName = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? "";
const versionFromTag = tagName.replace(/^v/, "");

if (!tagName || versionFromTag === tagName) {
  console.error("Release tag must be passed as vX.Y.Z, for example v0.1.1.");
  process.exit(1);
}

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const tauriConfig = JSON.parse(readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const cargoToml = readFileSync(join(root, "src-tauri", "Cargo.toml"), "utf8");
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = [
  ["package.json", packageJson.version],
  ["src-tauri/tauri.conf.json", tauriConfig.version],
  ["src-tauri/Cargo.toml", cargoVersion],
];

const mismatches = versions.filter(([, version]) => version !== versionFromTag);

if (mismatches.length > 0) {
  console.error(`Release tag ${tagName} does not match all app versions:`);
  for (const [source, version] of versions) {
    console.error(`- ${source}: ${version ?? "missing"}`);
  }
  process.exit(1);
}

console.log(`Release tag ${tagName} matches app version ${versionFromTag}.`);
