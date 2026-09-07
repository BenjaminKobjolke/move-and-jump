module.exports = {
  ignoreFiles: [
    "test/**",
    // Development-only trees. Without these they end up inside the .xpi:
    // `web-ext build` ships everything not listed here, and docs/,
    // claude-plans/, tmp/ and tools/ were all riding along. release_notes/
    // is deliberately absent — it *must* ship, the in-app view reads it.
    "docs/**",
    "claude-plans/**",
    "tmp/**",
    "tools/**",
    "package.json",
    "package-lock.json",
    "README.md",
    "ARCHITECTURE.md",
    "CHANGELOG.md",
    "ROADMAP.md",
    "LICENSE",
    ".github/**",
    "icons/icon.svg",
    "web-ext-config.cjs",
  ],
};
