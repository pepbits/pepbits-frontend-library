"use client";
// Port of lumen-reports src/components/reports/ReportLibrary.tsx.
import { Lock, Search, Star } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { SearchInput, useLocalization } from '@pepbits/ops-ui';
import { ReferenceLink } from '@pepbits/reference-host';
import { useReportsClient } from '../api/client';
import { Badge, Card, EmptyState } from '../ui/primitives';
import { useToast } from '../ui/Toast';
import { LocalizedText as ReferenceText, useLocalization as useReferenceLocalization } from '@pepbits/ops-ui';


export interface LibraryItem {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  kind: 'system' | 'custom';
  detail: boolean;
  tags: string[];
  favorite: boolean;
  mine: boolean;
  masked: boolean;
}

export function ReportLibrary({ reports, categories, initialQuery }: { reports: LibraryItem[]; categories: string[]; initialQuery: string }) {
 const referenceT = useReferenceLocalization().t;

  const { api } = useReportsClient();
  const { t } = useLocalization();
  const [items, setItems] = useState(reports);
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState<string>('all');
  const toast = useToast();

  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((r) => {
      if (cat === 'favorites' && !r.favorite) return false;
      if (cat === 'mine' && !r.mine) return false;
      if (cat !== 'all' && cat !== 'favorites' && cat !== 'mine' && r.category !== cat) return false;
      const hay = `${r.title} ${r.description} ${r.category} ${r.subcategory} ${r.tags.join(' ')} ${r.id}`.toLowerCase();
      return terms.every((term) => hay.includes(term));
    });
  }, [items, q, cat]);

  const groups = useMemo(() => {
    const m = new Map<string, LibraryItem[]>();
    for (const r of filtered) {
      const k = `${r.category} / ${r.subcategory}`;
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [filtered]);

  const toggle = async (id: string) => {
    try {
      const r = await api<{ favorite: boolean }>('/api/favorites', { body: { reportId: id } });
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, favorite: r.favorite } : x)));
    } catch (e) {
      toast.error(e);
    }
  };

  const count = (c: string) => (c === 'favorites' ? items.filter((r) => r.favorite).length : c === 'mine' ? items.filter((r) => r.mine).length : c === 'all' ? items.length : items.filter((r) => r.category === c).length);
  const filters = ['all', 'favorites', ...(items.some((r) => r.mine) ? ['mine'] : []), ...categories];
  const label = (c: string) => (c === 'all' ? 'All reports' : c === 'favorites' ? 'Favorites' : c === 'mine' ? 'Built by me' : c);

  return (
    <div className="lr-split-library">
      <nav aria-label={t('Report categories')} className="lr-sticky-side">
        <ul className="lr-category-list">
          {filters.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`lr-category${cat === c ? ' lr-category-active' : ''}`}>
                <span className="lr-inline">{c === 'favorites' && <Star className="lr-icon-sm lr-star-on" aria-hidden />}{t(label(c))}</span>
                <span className="lr-num lr-xs lr-muted">{count(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="lr-grow">
        <div className="lr-mb">
          <SearchInput value={q} onChange={setQ} onClear={() => setQ('')} placeholder={referenceT("Search by name, topic or tag, for example: denial, occupancy, ledger")} aria-label={referenceT("Search reports")} />
        </div>
        {groups.length === 0 ? (
          <Card><EmptyState title={referenceT("No reports match")} icon={<Search className="lr-icon-lg" />}><ReferenceText message="Try a different word, or choose All reports. Reports your role cannot open are not listed." /></EmptyState></Card>
        ) : (
          <div className="lr-stack-lg">
            {groups.map(([g, list]) => (
              <section key={g}>
                <h2 className="lr-group-title">{g}</h2>
                <Card as="div">
                  <ul className="lr-list">
                    {list.map((r) => (
                      <li key={r.id} className="lr-library-item">
                        <button type="button" onClick={() => toggle(r.id)} className="lr-icon-button" aria-pressed={r.favorite} aria-label={t(r.favorite ? 'Remove {title} from favorites' : 'Add {title} to favorites', { title: r.title })}>
                          <Star className={`lr-icon ${r.favorite ? 'lr-star-on' : 'lr-star-off'}`} aria-hidden />
                        </button>
                        <ReferenceLink href={`/reports/${r.id}`} className="lr-grow lr-plain-link">
                          <span className="lr-row lr-gap-xs">
                            <span className="lr-medium lr-hover-underline">{r.title}</span>
                            {r.kind === 'custom' && <Badge tone="brand"><ReferenceText message="Custom" /></Badge>}
                            {r.detail && <Badge><ReferenceText message="Row detail" /></Badge>}
                            {r.masked && <Badge tone="signal"><Lock className="lr-icon-xs" aria-hidden />{t('Masked columns')}</Badge>}
                          </span>
                          <span className="lr-block lr-muted lr-sm">{r.description}</span>
                        </ReferenceLink>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
