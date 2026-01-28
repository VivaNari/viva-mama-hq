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

  detectOpenHandles: true,

};