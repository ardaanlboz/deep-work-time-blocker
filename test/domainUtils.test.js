const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeDomain, toBlockVariants, isValidDomain } = require("../src/main/domainUtils");

test("normalizeDomain handles bare domains and strips www", () => {
  assert.equal(normalizeDomain("instagram.com"), "instagram.com");
  assert.equal(normalizeDomain("www.instagram.com"), "instagram.com");
});

test("normalizeDomain handles full URLs with paths", () => {
  assert.equal(
    normalizeDomain("https://instagram.com/explore/tags"),
    "instagram.com"
  );
  assert.equal(
    normalizeDomain("http://www.youtube.com/watch?v=test"),
    "youtube.com"
  );
});

test("normalizeDomain returns null for invalid inputs", () => {
  assert.equal(normalizeDomain(""), null);
  assert.equal(normalizeDomain("localhost"), null);
  assert.equal(normalizeDomain("not a domain"), null);
  assert.equal(normalizeDomain("https://"), null);
});

test("isValidDomain validates expected hostnames", () => {
  assert.equal(isValidDomain("example.com"), true);
  assert.equal(isValidDomain("sub.example.co"), true);
  assert.equal(isValidDomain("-bad.com"), false);
  assert.equal(isValidDomain("bad"), false);
});

test("toBlockVariants returns both base and www variants", () => {
  assert.deepEqual(toBlockVariants("instagram.com"), ["instagram.com", "www.instagram.com"]);
  assert.deepEqual(toBlockVariants("www.instagram.com"), ["instagram.com", "www.instagram.com"]);
  assert.deepEqual(toBlockVariants(""), []);
});
