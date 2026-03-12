process.env.NODE_ENV = "test";
module.exports = {
  preset: 'ts-jest/presets/js-with-ts-esm',
  resolver: "jest-ts-webcompat-resolver",
  clearMocks: true,
  globalTeardown: "./test-teardown-globals.cjs",
  testEnvironment: "node",
  roots: [
    "../__test__"
  ],
  testMatch: [
    "**/__test__/queue.test.js",
    "**/@(queue.)+(spec|test).[tj]s?(x)"
  ],
  verbose: false,
};
