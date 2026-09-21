const fs = require("fs");
const path = require("path");

// Answers "can this deployment be backed up?" rather than "does a file exist at
// a path relative to the repository?".
//
// The previous check looked for scripts/backup.sh relative to the repo root. The
// containers mount only backend/, so that path never resolves inside Docker and
// every containerized install was told backup and restore were unavailable —
// while `make backup` on the host worked fine. The check was reporting the
// mount layout, not the capability.
//
// Two methods can satisfy it:
//   script  — the shell scripts are reachable (host installs, or a deployment
//             that mounts them)
//   runtime — the backend can snapshot SQLite itself through the driver's online
//             backup API, which is what a container can actually do
//
// See docs/skills/sqlite-backup-restore.md.

const METHOD_SCRIPT = "script";
const METHOD_RUNTIME = "runtime";
const METHOD_NONE = "none";

function isWritableDir(dirPath) {
  try {
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveScriptsDir(env, rootDir) {
  if (env.BACKUP_SCRIPTS_DIR) {
    return path.isAbsolute(env.BACKUP_SCRIPTS_DIR)
      ? env.BACKUP_SCRIPTS_DIR
      : path.resolve(rootDir, env.BACKUP_SCRIPTS_DIR);
  }
  return path.resolve(rootDir, "..", "scripts");
}

function detectBackupCapability(options = {}) {
  const env = options.env || process.env;
  const rootDir = options.rootDir || __dirname;
  const { dataDir, sqlitePath, db } = options;

  const scriptsDir = resolveScriptsDir(env, rootDir);
  const backupScript = path.join(scriptsDir, "backup.sh");
  const restoreScript = path.join(scriptsDir, "restore.sh");

  const backupScriptAvailable = fs.existsSync(backupScript);
  const restoreScriptAvailable = fs.existsSync(restoreScript);
  const scriptsAvailable = backupScriptAvailable && restoreScriptAvailable;

  // The driver's online backup API plus a writable target is a real capability,
  // not a proxy for one: it is how a container takes a consistent snapshot.
  const runtimeAvailable =
    typeof db?.backup === "function" &&
    Boolean(sqlitePath) &&
    fs.existsSync(sqlitePath) &&
    Boolean(dataDir) &&
    isWritableDir(dataDir);

  let method = METHOD_NONE;
  if (scriptsAvailable) {
    method = METHOD_SCRIPT;
  } else if (runtimeAvailable) {
    method = METHOD_RUNTIME;
  }

  return {
    available: method !== METHOD_NONE,
    method,
    scripts_dir: scriptsDir,
    backup_script_available: backupScriptAvailable,
    restore_script_available: restoreScriptAvailable,
    runtime_available: runtimeAvailable
  };
}

module.exports = {
  detectBackupCapability,
  METHOD_SCRIPT,
  METHOD_RUNTIME,
  METHOD_NONE
};
