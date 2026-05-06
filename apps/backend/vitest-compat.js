// Compatibility shim so tests written for Vitest can run under Jest.
// Exports the common Vitest named exports (`beforeEach`, `afterEach`, `describe`, `it`, `expect`, `vi`) by delegating to Jest globals.

const { beforeEach: _beforeEach, afterEach: _afterEach, describe: _describe, it: _it, expect: _expect, test: _test } = global;

module.exports = {
  beforeEach: _beforeEach,
  afterEach: _afterEach,
  describe: _describe,
  it: _it || _test,
  test: _test || _it,
  expect: _expect,
  // `vi` is Vitest's mocking global — map it to Jest's `jest` object
  vi: global.jest,
};
