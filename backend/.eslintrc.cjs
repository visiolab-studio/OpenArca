module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest"
  },
  ignorePatterns: ["node_modules/", "data/", "uploads/"],
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
  }
};
