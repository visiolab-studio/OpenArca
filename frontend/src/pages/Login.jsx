import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import appLogo from "../assets/edudoro_itsc_logo.png";

const OTP_LIFETIME_SECONDS = 10 * 60;

function formatCountdown(seconds) {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const sec = Math.floor(clamped % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${sec}`;
}

function emptyDigits() {
  return ["", "", "", "", "", "", "", ""];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { requestOtp, verifyOtp } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(emptyDigits());
  const [phase, setPhase] = useState("request");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    if (!expiresAt) return OTP_LIFETIME_SECONDS;
    return Math.floor((expiresAt - now) / 1000);
  }, [expiresAt, now]);

  const code = digits.join("");

  async function requestOtpFlow() {
    setError("");
    setInfo("");
    setLoading(true);

    try {
      await requestOtp(email, language);
      setPhase("verify");
      setDigits(emptyDigits());
      setExpiresAt(Date.now() + OTP_LIFETIME_SECONDS * 1000);
      setInfo(t("auth.requestSuccess"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestOtp(event) {
    event.preventDefault();
    await requestOtpFlow();
  }

  async function handleVerifyOtp(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      await verifyOtp(email, code);
      navigate("/", { replace: true });
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setLoading(false);
    }
  }

  function updateDigit(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    if (digit && index < 7) {
      const nextInput = document.querySelector(`[data-otp-index=\"${index + 1}\"]`);
      if (nextInput) nextInput.focus();
    }
  }

  function handleDigitKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      const prevInput = document.querySelector(`[data-otp-index=\"${index - 1}\"]`);
      if (prevInput) prevInput.focus();
    }
  }

  function handlePaste(event) {
    const pasted = String(event.clipboardData.getData("text") || "")
      .replace(/\D/g, "")
      .slice(0, 8)
      .split("");

    if (!pasted.length) return;

    event.preventDefault();
    setDigits((current) => {
      const next = [...current];
      for (let index = 0; index < 8; index += 1) {
        next[index] = pasted[index] || "";
      }
      return next;
    });

    const focusIndex = Math.min(pasted.length, 7);
    const input = document.querySelector(`[data-otp-index=\"${focusIndex}\"]`);
    if (input) input.focus();
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-head-row">
          <div className="lang-switch auth-lang">
            <button
              type="button"
              className={language === "pl" ? "lang-option active" : "lang-option"}
              onClick={() => setLanguage("pl")}
            >
              <span className="flag flag-pl" aria-hidden="true" />
              <span>PL</span>
            </button>
            <button
              type="button"
              className={language === "en" ? "lang-option active" : "lang-option"}
              onClick={() => setLanguage("en")}
            >
              <span className="flag flag-us" aria-hidden="true" />
              <span>EN</span>
            </button>
          </div>
        </div>

        <div className="login-logo login-logo-image">
          <img src={appLogo} alt="EdudoroIT logo" className="auth-logo" />
        </div>

        <h1 className="login-title">{t("auth.title")}</h1>
        <p className="login-subtitle">{phase === "request" ? t("auth.email") : t("auth.code")}</p>

        {phase === "request" ? (
          <form className="form-grid" onSubmit={handleRequestOtp}>
            <label className="form-group">
              <span className="form-label">{t("auth.email")}</span>
              <input
                type="email"
                className="form-input"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading || !email.trim()}>
              {t("auth.sendCode")}
            </button>
          </form>
        ) : (
          <form className="form-grid" onSubmit={handleVerifyOtp}>
            <div className="otp-inputs" onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <span key={`otp-wrap-${index}`} className="otp-slot">
                  {index === 4 ? <span className="otp-separator">-</span> : null}
                  <input
                    data-otp-index={index}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]"
                    maxLength={1}
                    className={digit ? "otp-input filled" : "otp-input"}
                    value={digit}
                    onChange={(event) => updateDigit(index, event.target.value)}
                    onKeyDown={(event) => handleDigitKeyDown(index, event)}
                  />
                </span>
              ))}
            </div>

            <p className={countdown <= 60 ? "otp-timer expiring" : "otp-timer"}>
              {t("auth.expiresIn", { time: formatCountdown(countdown) })}
            </p>

            <div className="row-actions">
              <button type="submit" className="btn btn-primary" disabled={loading || code.length !== 8}>
                {t("auth.verify")}
              </button>
              <button type="button" className="btn btn-secondary" onClick={requestOtpFlow} disabled={loading}>
                {t("auth.resend")}
              </button>
            </div>
          </form>
        )}

        {info ? <p className="feedback ok">{info}</p> : null}
        {error ? (
          <p className="feedback err">
            {t(`errors.${error}`, { defaultValue: t(`auth.${error}`, { defaultValue: error }) })}
          </p>
        ) : null}
      </section>
    </main>
  );
}
