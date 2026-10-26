import { test } from "node:test";
import assert from "node:assert/strict";
import { filterIdentities } from "../lib/identities.js";

const identities = [
  { id: "work", name: "Benjamin Kobjolke", email: "benjamin@example.com", label: "Work" },
  { id: "personal", name: "Ben", email: "ben@personal.example", label: "Personal Account" },
];

test("filterIdentities returns all identities for an empty query", () => {
  assert.deepEqual(filterIdentities(identities, ""), identities);
  assert.deepEqual(filterIdentities(identities, "   "), identities);
});

test("filterIdentities matches every term regardless of term order", () => {
  assert.deepEqual(filterIdentities(identities, "example Benjamin"), [identities[0]]);
});

test("filterIdentities matches case-insensitively", () => {
  assert.deepEqual(filterIdentities(identities, "KOBJOLKE"), [identities[0]]);
});

test("filterIdentities searches name, email, and label", () => {
  assert.deepEqual(filterIdentities(identities, "Benjamin"), [identities[0]]);
  assert.deepEqual(filterIdentities(identities, "personal.example"), [identities[1]]);
  assert.deepEqual(filterIdentities(identities, "account personal"), [identities[1]]);
});
