import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "prisma", "schema.prisma");
const outputPath = path.join(root, "prisma", "schema.postgresql.prisma");
const source = await readFile(sourcePath, "utf8");
const sqliteProvider = 'provider = "sqlite"';
const providerMatches = source.match(new RegExp(sqliteProvider, "g")) ?? [];

if (providerMatches.length !== 1) {
  throw new Error("Expected exactly one SQLite provider in prisma/schema.prisma");
}

await writeFile(
  outputPath,
  source.replace(sqliteProvider, 'provider = "postgresql"'),
  "utf8"
);
