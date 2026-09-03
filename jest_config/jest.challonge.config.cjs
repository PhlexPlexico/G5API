process.env.NODE_ENV = "test";
module.exports = {
  preset: "ts-jest/presets/js-with-ts-esm",
  resolver: "jest-ts-webcompat-resolver",
  clearMocks: true,
  roots: ["../__test__"],
  testEnvironment: "node",
  testMatch: [
    "**/challonge.test.js",
    "**/@(challonge.)+(spec|test).[tj]s?(x)"
  ],
  verbose: false
};
