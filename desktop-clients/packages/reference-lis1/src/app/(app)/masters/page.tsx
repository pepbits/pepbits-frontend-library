'use client';
import {ReferenceLink as Link} from '@pepbits/reference-host';
import { ChevronRight } from 'lucide-react';
import { MASTERS } from '../../../lib/masters';
import { PageHeader } from '../../../components/ui';
import { useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export default function MastersIndex() {
 const referenceT = useReferenceLocalization().t;

  const groups = [...new Set(MASTERS.map((m) => m.group))];
  return (
    <div>
      <PageHeader title={referenceT("Masters")} subtitle={referenceT("Everything the laboratory runs on is configurable here – no code changes needed")} />
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-2 text-sm font-semibold text-ink-soft">{g}</div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {MASTERS.filter((m) => m.group === g).map((m) => (
                <Link key={m.slug} href={`/masters/${m.slug}`} className="card group flex items-start gap-3 p-3 hover:border-lab-500">
                  <div className="flex-1">
                    <div className="text-sm font-medium group-hover:text-lab-700">{m.title}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">{m.description}</div>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 text-ink-mute group-hover:text-lab-600" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
