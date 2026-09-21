const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { detectBackupCapability } = require("../core/backup-capability");

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openarca-backup-cap-"));
}

function createScripts(rootDir) {
  const scriptsDir = path.join(rootDir, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(path.join(scriptsDir, "backup.sh"), "#!/bin/sh\n", "utf8");
  fs.writeFileSync(path.join(scriptsDir, "restore.sh"), "#!/bin/sh\n", "utf8");
  return scriptsDir;
}

function createSqlite(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const sqlitePath = path.join(dataDir, "data.sqlite");
  fs.writeFileSync(sqlitePath, "", "utf8");
  return sqlitePath;
}

test("reachable scripts are reported as the script method", () => {
  const tmpDir = createTempDir();
  const backendDir = path.join(tmpDir, "backend");
  fs.mkdirSync(backendDir, { recursive: true });
  createScripts(tmpDir);

  const capability = detectBackupCapability({
    env: {},
    rootDir: backendDir,
    dataDir: tmpDir,
    sqlitePath: createSqlite(path.join(tmpDir, "data")),
    db: {}
  });

  assert.equal(capability.available, true);
  assert.equal(capability.method, "script");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("without scripts, a driver that can snapshot counts as the runtime method", () => {
  const tmpDir = createTempDir();
  const backendDir = path.join(tmpDir, "backend");
  fs.mkdirSync(backendDir, { recursive: true });
  const dataDir = path.join(tmpDir, "data");

  // This is the containerized case: scripts/ is outside the mount, but the
  // backend can still take a consistent snapshot through the driver.
  const capability = detectBackupCapability({
    env: {},
    rootDir: backendDir,
    dataDir,
    sqlitePath: createSqlite(dataDir),
    db: { backup() {} }
  });

  assert.equal(capability.available, true);
  assert.equal(capability.method, "runtime");
  assert.equal(capability.backup_script_available, false);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("no scripts and no snapshot support means no capability", () => {
  const tmpDir = createTempDir();
  const backendDir = path.join(tmpDir, "backend");
  fs.mkdirSync(backendDir, { recursive: true });
  const dataDir = path.join(tmpDir, "data");

  const capability = detectBackupCapability({
    env: {},
    rootDir: backendDir,
    dataDir,
    sqlitePath: createSqlite(dataDir),
    db: {}
  });

  assert.equal(capability.available, false);
  assert.equal(capability.method, "none");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a missing database file blocks the runtime method", () => {
  const tmpDir = createTempDir();
  const backendDir = path.join(tmpDir, "backend");
  fs.mkdirSync(backendDir, { recursive: true });
  const dataDir = path.join(tmpDir, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const capability = detectBackupCapability({
    env: {},
    rootDir: backendDir,
    dataDir,
    sqlitePath: path.join(dataDir, "absent.sqlite"),
    db: { backup() {} }
  });

  assert.equal(capability.runtime_available, false);
  assert.equal(capability.method, "none");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("a deployment can point at mounted scripts explicitly", () => {
  const tmpDir = createTempDir();
  const backendDir = path.join(tmpDir, "backend");
  fs.mkdirSync(backendDir, { recursive: true });
  const mounted = path.join(tmpDir, "opt", "scripts");
  fs.mkdirSync(mounted, { recursive: true });
  fs.writeFileSync(path.join(mounted, "backup.sh"), "#!/bin/sh\n", "utf8");
  fs.writeFileSync(path.join(mounted, "restore.sh"), "#!/bin/sh\n", "utf8");

  const capability = detectBackupCapability({
    env: { BACKUP_SCRIPTS_DIR: mounted },
    rootDir: backendDir,
    dataDir: tmpDir,
    sqlitePath: createSqlite(path.join(tmpDir, "data")),
    db: {}
  });

  assert.equal(capability.method, "script");
  assert.equal(capability.scripts_dir, mounted);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("only one of the two scripts is not enough", () => {
  const tmpDir = createTempDir();
  const backendDir = path.join(tmpDir, "backend");
  fs.mkdirSync(backendDir, { recursive: true });
  const scriptsDir = path.join(tmpDir, "scripts");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.writeFileSync(path.join(scriptsDir, "backup.sh"), "#!/bin/sh\n", "utf8");

  const capability = detectBackupCapability({
    env: {},
    rootDir: backendDir,
    dataDir: tmpDir,
    sqlitePath: createSqlite(path.join(tmpDir, "data")),
    db: {}
  });

  // A backup you cannot restore is not a backup.
  assert.equal(capability.method, "none");

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
