// Version tool for the release workflow. manifest.json is the single source of
// truth — web-ext's {version} filename placeholder, the vX.Y.Z tag, and the ATN
// listing all read it — and package.json is rewritten in lockstep so it can't
// drift out of sync again (it sat at 1.2.0 while the add-on shipped 1.4.2).
//
// Usage: node tools/version.mjs get | bump [patch|minor|major] | set <x.y.z>
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILES = ["manifest.json", "package.json"];
const SEMVER = /^\d+\.\d+\.\d+$/;

/** The next version after `current` for a patch/minor/major bump. */
export function nextVersion(current, level = "patch") {
  if (!SEMVER.test(current)) throw new Error(`Not a semver version: ${current}`);
  const [major, minor, patch] = current.split(".").map(Number);
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  if (level === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump level: ${level}`);
}

const current = () => JSON.parse(readFileSync(ROOT + "manifest.json", "utf8")).version;

/**
 * Rewrite just the "version" value in each file, rather than re-serialising the
 * JSON, so formatting and key order survive untouched. "manifest_version" and
 * "strict_min_version" don't match: the pattern requires a quote before "version".
 */
function write(next) {
  if (!SEMVER.test(next)) throw new Error(`Not a semver version: ${next}`);
  for (const file of FILES) {
    const text = readFileSync(ROOT + file, "utf8");
    const rewritten = text.replace(/("version":\s*")[^"]*(")/, `$1${next}$2`);
    if (rewritten === text) throw new Error(`No "version" key rewritten in ${file}`);
    writeFileSync(ROOT + file, rewritten);
  }
  return next;
}

function main([command, arg]) {
  if (command === "get") return current();
  if (command === "bump") return write(nextVersion(current(), arg ?? "patch"));
  if (command === "set") return write(arg);
  console.error("usage: node tools/version.mjs get | bump [patch|minor|major] | set <x.y.z>");
  process.exit(1);
}

// Only act when run as a script; importing it (the unit test) must not write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(main(process.argv.slice(2)));
}
