import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col px-4 sm:px-6 lg:px-10">
      <div className="flex h-16 items-center">
        <Logo />
      </div>
      <div className="mx-auto flex max-w-md flex-1 flex-col justify-center pb-16">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.025em] text-ink-900">This page doesn&apos;t exist</h1>
        <p className="mt-3 leading-relaxed text-ink-600">Check the address, or go back to the start.</p>
        <div className="mt-7 flex gap-3">
          <ButtonLink href="/">Go to home</ButtonLink>
          <ButtonLink href="/workspace" variant="secondary">
            Find your workspace
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
