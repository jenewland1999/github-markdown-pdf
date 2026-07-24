import { cp, lstat, mkdir, readFile, readlink, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OWNER = "github-markdown-pdf:markdown-to-pdf";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const canonicalSkill = resolve(root, "skill", "markdown-to-pdf");

export function skillDestinations(
  home: string,
  pathApi: Pick<typeof path, "join"> = path,
): string[] {
  return [
    pathApi.join(home, ".agents", "skills", "markdown-to-pdf"),
    pathApi.join(home, ".claude", "skills", "markdown-to-pdf"),
  ];
}

async function exists(location: string): Promise<boolean> {
  return lstat(location).then(
    () => true,
    () => false,
  );
}

async function ownedByTool(location: string): Promise<boolean> {
  const info = await lstat(location).catch(() => undefined);
  if (!info) return false;
  if (info.isSymbolicLink()) {
    const target = resolve(dirname(location), await readlink(location));
    if (target === canonicalSkill) return true;
  }
  return readFile(path.join(location, ".github-markdown-pdf-owner"), "utf8").then(
    (value) => value.trim() === OWNER,
    () => false,
  );
}

export interface InstallSkillOptions {
  home?: string;
  force?: boolean;
  copy?: boolean;
  platform?: NodeJS.Platform;
}

export async function installSkill(options: InstallSkillOptions = {}): Promise<string[]> {
  const home = options.home ?? homedir();
  const destinations = skillDestinations(home);
  const installed: string[] = [];
  for (const destination of destinations) {
    if ((await exists(destination)) && !options.force && !(await ownedByTool(destination))) {
      throw new Error(
        `Refusing to replace unrelated skill installation: ${destination}. Re-run with --force to replace it.`,
      );
    }
  }
  for (const destination of destinations) {
    await mkdir(dirname(destination), { recursive: true });
    if (await exists(destination)) {
      await rm(destination, { recursive: true, force: true });
    }
    if (options.copy) {
      await cp(canonicalSkill, destination, { recursive: true });
    } else {
      try {
        await symlink(
          canonicalSkill,
          destination,
          options.platform === "win32" || process.platform === "win32" ? "junction" : "dir",
        );
      } catch {
        await cp(canonicalSkill, destination, { recursive: true });
      }
    }
    if (!(await exists(path.join(destination, "SKILL.md"))))
      throw new Error(`Skill installation incomplete: ${destination}`);
    installed.push(destination);
    process.stdout.write(`Installed skill: ${destination}\n`);
  }
  process.stdout.write(
    "Restart agent or reload skills if markdown-to-pdf is not discovered immediately.\n",
  );
  return installed;
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  installSkill({ force: args.has("--force"), copy: args.has("--copy") }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
