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

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { requestOtp, verifyOtp } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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

  async function handleRequestOtp(event) {
    event.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      await requestOtp(email, language);
      setPhase("verify");
      setExpiresAt(Date.now() + OTP_LIFETIME_SECONDS * 1000);
      setInfo(t("auth.requestSuccess"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
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

  return (
    <main className="page page-center">
      <section className="auth-panel">
        <div className="auth-header">
          <div className="auth-brand">
            <img src={appLogo} alt="EdudoroIT logo" className="brand-logo" />
            <h1>{t("auth.title")}</h1>
          </div>
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

        {phase === "request" ? (
          <form className="form-grid" onSubmit={handleRequestOtp}>
            <label>
              {t("auth.email")}
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <button type="submit" className="btn" disabled={loading}>
              {t("auth.sendCode")}
            </button>
          </form>
        ) : (
          <form className="form-grid" onSubmit={handleVerifyOtp}>
            <label>
              {t("auth.code")}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{8}"
                minLength={8}
                maxLength={8}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
              />
            </label>
            <p className="muted">{t("auth.expiresIn", { time: formatCountdown(countdown) })}</p>
            <div className="row-actions">
              <button type="submit" className="btn" disabled={loading || code.length !== 8}>
                {t("auth.verify")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleRequestOtp} disabled={loading}>
                {t("auth.resend")}
              </button>
            </div>
          </form>
        )}

        {info ? <p className="feedback ok">{info}</p> : null}
        {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: t(`auth.${error}`, { defaultValue: error }) })}</p> : null}
      </section>
    </main>
  );
}
