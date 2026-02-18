module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    }
  },
  ignorePatterns: ["dist/", "node_modules/"],
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
  }
};
