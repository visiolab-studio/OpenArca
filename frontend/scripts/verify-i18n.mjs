import fs from "node:fs";
import path from "node:path";

// Guards translation dictionaries against drift. Driven by src/i18n/languages.json
// so adding a language costs a config entry rather than an edit here — and so the
// guard and the runtime cannot disagree about which languages exist.

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const i18nDir = path.join(sourceRoot, "i18n");

const config = JSON.parse(fs.readFileSync(path.join(i18nDir, "languages.json"), "utf8"));
const { reference, languages, foreignCharacters = {}, sourcePattern, sourceReason } = config;

if (!languages.includes(reference)) {
  console.error(`Reference language "${reference}" is not listed in languages.json`);
  process.exit(1);
}

function flatten(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return flatten(entry, nextKey);
    }
    return [[nextKey, entry]];
  });
}

function hasKey(value, key) {
  let current = value;
  for (const part of key.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

function listSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "test") return [];
      return listSourceFiles(fullPath);
    }
    return /\.(jsx?|tsx?)$/.test(entry.name) ? [fullPath] : [];
  });
}

const dictionaries = new Map();
const entriesByLanguage = new Map();

for (const language of languages) {
  const filePath = path.join(i18nDir, `${language}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Dictionary missing for language "${language}": ${path.relative(root, filePath)}`);
    process.exit(1);
  }
  const dictionary = JSON.parse(fs.readFileSync(filePath, "utf8"));
  dictionaries.set(language, dictionary);
  entriesByLanguage.set(language, new Map(flatten(dictionary)));
}

const failures = [];
const referenceEntries = entriesByLanguage.get(reference);

// Parity is checked against the reference in both directions, so a key added to
// any one language is caught regardless of which file it was added to.
for (const language of languages) {
  if (language === reference) continue;
  const entries = entriesByLanguage.get(language);

  const missingHere = [...referenceEntries.keys()].filter((key) => !entries.has(key));
  if (missingHere.length) {
    failures.push(`Missing ${language} keys: ${missingHere.join(", ")}`);
  }

  const missingInReference = [...entries.keys()].filter((key) => !referenceEntries.has(key));
  if (missingInReference.length) {
    failures.push(
      `Missing ${reference} keys (present in ${language}): ${missingInReference.join(", ")}`
    );
  }
}

// Catches a dictionary still holding another language's text — the usual symptom
// of a file copied as a starting point and never actually translated.
for (const [language, guard] of Object.entries(foreignCharacters)) {
  const entries = entriesByLanguage.get(language);
  if (!entries) continue;

  const pattern = new RegExp(guard.pattern);
  const offenders = [...entries].filter(
    ([, value]) => typeof value === "string" && pattern.test(value)
  );

  if (offenders.length) {
    failures.push(
      `${language} translations contain ${guard.reason}: ${offenders
        .map(([key]) => key)
        .join(", ")}`
    );
  }
}

const dictionaryFiles = new Set(
  languages.map((language) => path.join("src", "i18n", `${language}.json`))
);
const sourceRegExp = sourcePattern ? new RegExp(sourcePattern) : null;
const runtimeOffenders = [];
const missingStaticKeys = [];
const staticKeyPattern = /\bt\(\s*["']([^"'`$]+)["']/g;

for (const filePath of listSourceFiles(sourceRoot)) {
  const relativePath = path.relative(root, filePath);
  const text = fs.readFileSync(filePath, "utf8");

  if (sourceRegExp && !dictionaryFiles.has(relativePath) && sourceRegExp.test(text)) {
    runtimeOffenders.push(relativePath);
  }

  for (const match of text.matchAll(staticKeyPattern)) {
    const key = match[1];
    const absentFrom = languages.filter((language) => !hasKey(dictionaries.get(language), key));
    if (absentFrom.length) {
      missingStaticKeys.push({ file: relativePath, key, absentFrom });
    }
  }
}

if (runtimeOffenders.length) {
  failures.push(`Runtime source contains ${sourceReason}: ${runtimeOffenders.join(", ")}`);
}

if (missingStaticKeys.length) {
  failures.push(
    `Static t() keys missing from dictionaries: ${missingStaticKeys
      .map((item) => `${item.key} (${item.file}, missing in ${item.absentFrom.join("/")})`)
      .join(", ")}`
  );
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `i18n guard passed: ${languages
    .map((language) => `${language}=${entriesByLanguage.get(language).size}`)
    .join(", ")} keys`
);
