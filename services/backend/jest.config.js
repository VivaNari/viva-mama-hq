const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
    "^.+\\.js$": ["ts-jest", {
      useESM: false,
    }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!.*/)"
  ],

  moduleFileExtensions: ["ts", "js"],

  testMatch: ["**/__tests__/**/*.test.ts"],

  // Must be setupFiles, not setupFilesAfterEnv: src/config/env.ts snapshots process.env
  // at import time, so anything running after the module graph loads is too late.
  setupFiles: ["<rootDir>/__tests__/helpers/testEnv.ts"],

  detectOpenHandles: true,

};