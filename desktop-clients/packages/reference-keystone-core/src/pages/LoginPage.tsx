'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from '../lib/navigation';
import { Eye, EyeOff, KeyRound, LogIn } from 'lucide-react';
import { useAuth } from '../lib/session';
import { LogoMark } from '../components/shell/Logo';
import { Button, Checkbox, Input, Label } from '../components/ui';
import { APP } from '../lib/config';
import { useKeystoneVariant } from '../lib/variant';
import { useCompanyProfile } from '../lib/api';
import { LocalizedText as ReferenceText } from '@pepbits/ops-ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';



function LoginForm() {
 const referenceT = useReferenceLocalization().t;

  const company = useCompanyProfile().data?.company;
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/workspace/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The host owns the authenticated session, so a signed-in user is not bounced away
  // from this preserved sign-in screen (source redirected when a stored session existed).

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password, remember);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="mb-6 flex items-center gap-3 lg:hidden">
        <LogoMark size={32} />
        <span className="text-[length:calc(17px*var(--fs-scale))] font-semibold">{APP.product}</span>
      </div>
      <h1 className="text-[length:calc(22px*var(--fs-scale))] font-semibold tracking-tight text-ink"><ReferenceText message="Sign in" /></h1>
      <p className="mt-1 text-[length:calc(13.5px*var(--fs-scale))] text-ink-3">{company ? `Use your work account for ${company}.` : referenceT("Use your work account.")}</p>

      <div className="mt-6 space-y-3.5">
        <div>
          <Label htmlFor="email" required><ReferenceText message="Work email" /></Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required><ReferenceText message="Password" /></Label>
            <button type="button" className="mb-1 text-[length:calc(12px*var(--fs-scale))] text-brand hover:underline" onClick={() => setError('Password reset is not available in the demo. Any password of 4+ characters works.')}><ReferenceText message="Forgot password?" /></button>
          </div>
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-10 pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <Checkbox checked={remember} onChange={setRemember} label={<span className="text-ink-2"><ReferenceText message="Keep me signed in on this device" /></span>} />
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[length:calc(12.5px*var(--fs-scale))] text-danger">{error}</p>}
        <Button type="submit" variant="primary" icon={LogIn} loading={busy} className="h-10 w-full text-[length:calc(14px*var(--fs-scale))]"><ReferenceText message="Sign in" /></Button>
        <div className="flex items-center gap-3 py-1 text-[length:calc(12px*var(--fs-scale))] text-ink-3"><span className="h-px flex-1 bg-line" /><ReferenceText message="or" /><span className="h-px flex-1 bg-line" /></div>
        <Button type="button" icon={KeyRound} className="h-10 w-full" onClick={() => setError('Single sign-on is not configured in the demo. Use email and password.')}><ReferenceText message="Continue with single sign-on" /></Button>
      </div>
      <p className="mt-6 text-[length:calc(12px*var(--fs-scale))] text-ink-3"><ReferenceText message="Demo mode: any email and a password of 4 or more characters will sign you in." /></p>
    </form>
  );
}

export default function LoginPage() {
 const referenceT = useReferenceLocalization().t;

  const { pages, sections } = useKeystoneVariant();
  const company = useCompanyProfile().data?.company;
  const counts = sections.map((s) => ({ label: s.label, n: pages.filter((p) => p.section === s.key).length }));
  return (
    <div className="flex h-full min-h-[560px] bg-surface">
      <aside className="relative hidden w-[44%] max-w-[560px] flex-col justify-between overflow-hidden bg-rail p-10 text-rail-ink lg:flex">
        <svg className="pointer-events-none absolute -right-44 -bottom-56 opacity-[0.06]" width="520" height="520" viewBox="0 0 32 32" aria-hidden>
          <path d="M9.5 3h13l-3 20h-7z" fill="var(--accent)" />
          <path d="M1 30c4-4 8-6.5 12-7M31 30c-4-4-8-6.5-12-7" stroke="var(--accent)" strokeWidth="1.2" fill="none" />
        </svg>
        <div className="flex items-center gap-3">
          <LogoMark size={34} />
          <div>
            <div className="text-[length:calc(17px*var(--fs-scale))] font-semibold text-white">{APP.product}</div>
            <div className="text-[length:calc(12px*var(--fs-scale))] text-rail-ink-2">{company ?? '\u00a0'}</div>
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="text-[length:calc(30px*var(--fs-scale))] font-semibold leading-[1.15] tracking-tight text-white"><ReferenceText message="Every order, voucher and payslip in one ledger you can trust." /></p>
          <p className="mt-4 text-[length:calc(14px*var(--fs-scale))] leading-relaxed text-rail-ink"><ReferenceText message="Masters, transactions and reports share one data model, so a customer created in the morning is on an invoice by lunch and in the aging report by close." /></p>
          <dl className="mt-8 grid grid-cols-5 gap-2 border-t border-rail-3 pt-5">
            {counts.map((c) => (
              <div key={c.label}>
                <dt className="text-[length:calc(11.5px*var(--fs-scale))] text-rail-ink-2"><ReferenceText message={c.label} /></dt>
                <dd className="text-[length:calc(20px*var(--fs-scale))] font-semibold text-white tnum">{c.n}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-[length:calc(12px*var(--fs-scale))] text-rail-ink-2">{APP.suite} {APP.version}</p>
      </aside>
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
