import test from "node:test";
import assert from "node:assert/strict";
import { nextVersion } from "../tools/version.mjs";

test("nextVersion bumps the requested component and zeroes the rest", () => {
  assert.equal(nextVersion("1.4.2"), "1.4.3");
  assert.equal(nextVersion("1.4.2", "patch"), "1.4.3");
  assert.equal(nextVersion("1.4.2", "minor"), "1.5.0");
  assert.equal(nextVersion("1.4.2", "major"), "2.0.0");
  assert.equal(nextVersion("1.9.9", "patch"), "1.9.10");
});

test("nextVersion rejects a non-semver version and an unknown level", () => {
  assert.throws(() => nextVersion("1.4"), /Not a semver version/);
  assert.throws(() => nextVersion("v1.4.2"), /Not a semver version/);
  assert.throws(() => nextVersion("1.4.2", "build"), /Unknown bump level/);
});
