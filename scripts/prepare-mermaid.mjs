import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(root, "node_modules/mermaid");
const sourceDistDir = resolve(sourceDir, "dist");
const targetDir = resolve(root, "vendor");
const targetRuntimeDir = resolve(targetDir, "mermaid-esm");

const entrySource = resolve(sourceDistDir, "mermaid.esm.min.mjs");
const chunksSource = resolve(sourceDistDir, "chunks/mermaid.esm.min");
const licenseSource = resolve(sourceDir, "LICENSE");

for (const source of [entrySource, chunksSource, licenseSource]) {
  if (!existsSync(source)) {
    throw new Error(`Mermaid runtime file is missing: ${source}`);
  }
}

rmSync(targetRuntimeDir, { recursive: true, force: true });
mkdirSync(targetRuntimeDir, { recursive: true });
copyFileSync(entrySource, resolve(targetRuntimeDir, "mermaid.esm.min.mjs"));
cpSync(chunksSource, resolve(targetRuntimeDir, "chunks/mermaid.esm.min"), { recursive: true });

mkdirSync(targetDir, { recursive: true });
copyFileSync(licenseSource, resolve(targetDir, "MERMAID-LICENSE.txt"));
