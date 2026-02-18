const fs = require("fs");
const os = require("os");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

function initTestEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edudoroit-backend-test-"));
  const dataDir = path.join(root, "data");
  const uploadsDir = path.join(root, "uploads");

  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.JWT_EXPIRES_IN = "30d";
  process.env.PORT = "0";
  process.env.APP_URL = "http://localhost:3000";
  process.env.FRONTEND_ORIGIN = "http://localhost:3000";
  process.env.DATA_DIR = dataDir;
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.SQLITE_PATH = path.join(dataDir, "test.sqlite");

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  return { root, dataDir, uploadsDir };
}

function cleanupTestEnv(root) {
  if (root && fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function loginByOtp({ request, db, email }) {
  const requestResult = await request
    .post("/api/auth/request-otp")
    .send({ email, lang: "pl" });

  if (requestResult.statusCode !== 200) {
    throw new Error(`request-otp failed for ${email}: ${requestResult.statusCode}`);
  }

  const otp = db
    .prepare(
      `SELECT code
       FROM otp_codes
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(email.toLowerCase());

  if (!otp) {
    throw new Error(`OTP not found for ${email}`);
  }

  const verifyResult = await request
    .post("/api/auth/verify-otp")
    .send({ email, code: otp.code });

  if (verifyResult.statusCode !== 200) {
    throw new Error(`verify-otp failed for ${email}: ${verifyResult.statusCode}`);
  }

  return verifyResult.body;
}

function makeBugPayload(overrides = {}) {
  return {
    title: "Błąd zapisu formularza zgłoszeniowego",
    description:
      "Po kliknięciu przycisku zapisz formularz zgłoszenia zwraca błąd 500 i nie zapisuje danych. Dzieje się to regularnie po kilku próbach i blokuje pracę zespołu.",
    steps_to_reproduce:
      "1. Wejdź na stronę formularza zgłoszeniowego. 2. Uzupełnij wszystkie pola. 3. Kliknij Zapisz i obserwuj błąd serwera.",
    expected_result: "Formularz zapisuje zgłoszenie i pokazuje numer ticketu użytkownikowi.",
    actual_result: "Aplikacja zwraca błąd 500, a zgłoszenie nie jest tworzone.",
    environment: "Chrome 121, macOS 14, produkcja, https://app.example.com",
    category: "bug",
    urgency_reporter: "high",
    ...overrides
  };
}

function uniqueEmail(prefix) {
  return `${prefix}.${uuidv4().slice(0, 8)}@example.com`;
}

module.exports = {
  cleanupTestEnv,
  initTestEnv,
  loginByOtp,
  makeBugPayload,
  uniqueEmail
};
