'use client';
import Link from '../lib/navigation';
import { useParams } from '../lib/navigation';
import { Compass } from 'lucide-react';
import { useKeystoneVariant } from '../lib/variant';
import { ReadyPage } from '../components/ReadyPage';
import { Button, Empty } from '../components/ui';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


/**
 * One dynamic route renders every page in the registry.
 * The source global Header (removed: the host owns application chrome) showed the page
 * title; a lightweight in-page heading from the registry definition replaces it.
 */
export default function RegistryPage() {
 const referenceT = useReferenceLocalization().t;

  const { section, slug } = useParams<{ section: string; slug: string }>();
  const { findPage, sections, templates } = useKeystoneVariant();
  const def = findPage(section, slug);
  if (!def) {
    return (
      <Empty
        icon={Compass}
        title={referenceT("This page does not exist")}
        body={`There is no page at /${section}/${slug}. It may have been renamed or removed from the registry.`}
        action={<Link href="/workspace/dashboard"><Button variant="primary"><ReferenceText message="Go to dashboard" /></Button></Link>}
        className="h-full"
      />
    );
  }
  const Template = templates[def.template];
  const sectionLabel = sections.find((x) => x.key === def.section)?.label ?? def.section;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-3 pt-2.5 md:px-4">
        <p className="text-[length:calc(11.5px*var(--fs-scale))] text-ink-3">{referenceT(sectionLabel)} · {referenceT(def.group)}</p>
        <h1 className="truncate text-[length:calc(16px*var(--fs-scale))] font-semibold tracking-tight text-ink">{referenceT(def.title)}</h1>
        {def.description && <p className="truncate text-[length:calc(12.5px*var(--fs-scale))] text-ink-3" title={referenceT(def.description)}>{referenceT(def.description)}</p>}
      </header>
      <div className="min-h-0 flex-1">
        <ReadyPage key={`${def.section}/${def.slug}`} def={def}>{(ready) => <Template def={ready} />}</ReadyPage>
      </div>
    </div>
  );
}
