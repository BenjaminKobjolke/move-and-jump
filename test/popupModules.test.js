import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const popupDirectory = path.join(projectRoot, "popup");
const importPattern = /import\s*\{([^}]+)\}\s*from\s*["'](\.{1,2}\/[^"']+)["']/g;
const exportPattern = (name) =>
  new RegExp(`\\bexport\\s+(?:async\\s+)?(?:function|const|let)\\s+${name}\\b`);

test("popup relative imports resolve to exported declarations", () => {
  const popupFiles = readdirSync(popupDirectory).filter((file) => file.endsWith(".js"));

  for (const sourceFile of popupFiles) {
    const sourcePath = path.join(popupDirectory, sourceFile);
    const source = readFileSync(sourcePath, "utf8");

    for (const [, importedNames, relativePath] of source.matchAll(importPattern)) {
      const targetPath = path.resolve(path.dirname(sourcePath), relativePath);
      assert.ok(
        popupFiles.includes(path.basename(targetPath)) || targetPath.startsWith(`${projectRoot}${path.sep}lib${path.sep}`),
        `${sourceFile} imports from a missing file: ${relativePath}`,
      );

      const target = readFileSync(targetPath, "utf8");
      for (const specifier of importedNames.split(",").filter((part) => part.trim())) {
        const match = specifier.trim().match(/^(\w+)(?:\s+as\s+\w+)?$/);
        assert.ok(match, `${sourceFile} has an unsupported import specifier: ${specifier.trim()}`);
        assert.match(
          target,
          exportPattern(match[1]),
          `${sourceFile} imports ${match[1]} from ${relativePath}, but it is not exported`,
        );
      }
    }
  }
});
