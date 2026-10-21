import { useEffect, useRef, useState } from "react";
import { CircleAlert, MailCheck } from "lucide-react";
import { readHostError } from "../registration";
import type { RegistrationHostError } from "../types";
import { Button } from "../ui/Button";
import { OtpInput } from "../ui/OtpInput";

export const CODE_LENGTH = 6;

/**
 * Email ownership check. The code lives only in this component's state: it is
 * never written to form data, the draft or any storage.
 */
export function CodeStage({
  email,
  requestCode,
  verifyCode,
  resendDelaySeconds,
  onVerified,
  onBack,
  onChangeEmail,
  onFieldError,
}: {
  email: string;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  resendDelaySeconds: number;
  onVerified: () => void;
  onBack: () => void;
  onChangeEmail: () => void;
  /** Returns true when the error named a form field and the wizard took over. */
  onFieldError: (error: RegistrationHostError) => boolean;
}) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const requested = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  async function send() {
    setSending(true);
    setError(null);
    try {
      await requestCode(email);
      setSent(true);
      setCode("");
      setRemaining(resendDelaySeconds);
    } catch (err) {
      const e = readHostError(err, "We couldn't send the code. Check your connection and try again.");
      if (!(e.field && onFieldError(e))) setError(e.message);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    // Guarded so a development double-mount does not send two codes.
    if (requested.current) return;
    requested.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  async function verify(value: string) {
    if (verifying) return;
    if (value.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from the email.`);
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await verifyCode(email, value);
      onVerified();
    } catch (err) {
      const e = readHostError(err, "That code didn't work. Check it and try again.");
      if (!(e.field && onFieldError(e))) {
        setError(e.message);
        setCode("");
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl animate-step-in py-6 lg:py-10">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-scrub-700 text-white">
        <MailCheck className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.025em] text-ink-900 focus:outline-none sm:text-[2.5rem]"
      >
        Confirm your email
      </h1>
      <p className="mt-2.5 leading-relaxed text-ink-600" aria-live="polite">
        {sent ? (
          <>
            We sent a {CODE_LENGTH}-digit code to <strong className="font-semibold text-ink-900">{email}</strong>. Enter it below.
          </>
        ) : sending ? (
          <>
            Sending a code to <strong className="font-semibold text-ink-900">{email}</strong>…
          </>
        ) : (
          <>
            We&apos;ll send a {CODE_LENGTH}-digit code to <strong className="font-semibold text-ink-900">{email}</strong>.
          </>
        )}
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 flex animate-shake items-start gap-3 rounded-2xl border border-signal/25 bg-[#FFF5F5] px-4 py-3 text-sm text-signal"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      <form
        className="mt-7"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void verify(code);
        }}
      >
        <OtpInput
          label="Verification code"
          value={code}
          onChange={setCode}
          onComplete={(v) => void verify(v)}
          length={CODE_LENGTH}
          invalid={!!error}
          disabled={verifying || !sent}
          autoFocus={sent}
        />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" loading={verifying} disabled={!sent || code.length !== CODE_LENGTH} className="min-w-[9.5rem]">
            {verifying ? "Verifying" : "Verify email"}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => void send()} disabled={sending || remaining > 0} loading={sending}>
            {remaining > 0 ? `Resend code in ${remaining}s` : sent ? "Resend code" : "Send code"}
          </Button>
        </div>
      </form>

      <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <button type="button" onClick={onChangeEmail} className="font-semibold text-scrub-700 underline-offset-2 hover:underline">
          Use a different email
        </button>
        <button type="button" onClick={onBack} className="font-semibold text-ink-600 underline-offset-2 hover:underline">
          Back to review
        </button>
      </div>
    </div>
  );
}
