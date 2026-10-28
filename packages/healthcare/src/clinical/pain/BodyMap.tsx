"use client";
import React, {useId, useState} from "react";
import {Button, Input, Select, Segmented} from "@pepbits/ui";
import {useLocalization} from "@pepbits/i18n/react";
import {useFormatters} from "@pepbits/patterns/screen-host";
import type {Codesets, MapRegion, MapView, PainMaps, PainSite} from "../models/consult-records";
import {displayCode, emptySite, siteKey, siteLabel} from "./model";

/** Catalogue geometry is clinical content; semantic controls and keyboard interaction surround the SVG. */
export function BodyMapSvg({view, selected, scoreOf, max = 10, onToggle, codes}: {
  view: MapView; selected: Set<string>; scoreOf?: (key: string) => number | null | undefined; max?: number; onToggle?: (r: MapRegion) => void; codes: Codesets | null;
}) {
  const {t} = useLocalization(), clip = `body-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [hover, setHover] = useState<MapRegion | null>(null);
  const fill = (key: string) => {const score = scoreOf?.(key); return score == null ? "var(--primary)" : score / Math.max(max, 1) > 0.6 ? "var(--danger)" : score > 0 ? "var(--warning)" : "var(--success)";};
  return <figure><svg viewBox={view.viewBox} className="h-[420px] max-h-[60vh] w-full" role="group" aria-label={t("Body map, {view}", {view: view.label})}>
    {view.outline ? <><defs><clipPath id={clip}><path d={view.outline}/></clipPath></defs><path d={view.outline} fill="var(--surface-2)" stroke="var(--text-muted)" strokeWidth={2}/></> : null}
    <g clipPath={view.outline ? `url(#${clip})` : undefined}>{view.regions.map(r => {
      const key = siteKey(r), on = selected.has(key), label = t(r.label ?? siteLabel(codes, r));
      return <path key={r.id} d={r.d} role={onToggle ? "checkbox" : undefined} aria-label={label} aria-checked={onToggle ? on : undefined} tabIndex={onToggle ? 0 : undefined}
        onClick={() => onToggle?.(r)} onKeyDown={e => {if (onToggle && (e.key === "Enter" || e.key === " ")) {e.preventDefault(); onToggle(r);}}}
        onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r)} onBlur={() => setHover(null)}
        fill={on ? fill(key) : hover?.id === r.id ? "var(--primary-soft)" : "var(--surface-2)"} stroke="var(--text-muted)" strokeWidth={hover?.id === r.id ? 2 : 0.8} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"><title>{label}</title></path>;
    })}</g>
    {view.markers.map((m, i) => <text key={i} x={m.x} y={m.y} textAnchor="middle" fill="var(--text-muted)" aria-hidden="true">{t(m.text)}</text>)}
  </svg><figcaption aria-live="polite">{t(hover ? hover.label ?? siteLabel(codes, hover) : view.label)}</figcaption></figure>;
}

export function BodyMapPicker({maps, codes, sites, onChange, scoreChoices, scoreMax, readOnly = false}: {
  maps: PainMaps; codes: Codesets; sites: PainSite[]; onChange: (sites: PainSite[]) => void; scoreChoices?: number[]; scoreMax: number; readOnly?: boolean;
}) {
  const {t} = useLocalization(), format = useFormatters();
  const [mapId, setMapId] = useState(maps.primary), [viewId, setViewId] = useState(""), [part, setPart] = useState(""), [side, setSide] = useState("BILATERAL");
  const map = maps.maps.find(m => m.id === mapId) ?? maps.maps[0], view = map?.views.find(v => v.id === viewId) ?? map?.views[0];
  const selected = new Set(sites.map(siteKey));
  const add = (site: PainSite) => {if (!readOnly && !selected.has(siteKey(site)) && sites.length < 20) onChange([...sites, site]);};
  const update = (i: number, patch: Partial<PainSite>) => {if (!readOnly) onChange(sites.map((s, j) => i === j ? {...s, ...patch} : s));};
  return <fieldset disabled={readOnly} className="grid gap-3 lg:grid-cols-2"><div>
    <Select label="Body map" value={map?.id ?? ""} options={[...maps.maps].sort((a, b) => Number(maps.applicable.includes(b.id)) - Number(maps.applicable.includes(a.id))).map(m => ({value: m.id, label: m.title}))} onChange={e => {setMapId(e.target.value); setViewId("");}}/>
    {map && map.views.length > 1 ? <><Segmented label="View" value={view?.id ?? ""} options={map.views.map(v => ({value: v.id, label: v.label, disabled: readOnly}))} onChange={setViewId}/><Button variant="ghost" onClick={() => setViewId(map.views[(map.views.findIndex(v => v.id === view?.id) + 1) % map.views.length]!.id)}>Turn the body map</Button></> : null}
    {view ? <BodyMapSvg view={view} selected={selected} codes={codes} max={scoreMax} scoreOf={key => sites.find(s => siteKey(s) === key)?.score} onToggle={readOnly ? undefined : r => selected.has(siteKey(r)) ? onChange(sites.filter(s => siteKey(s) !== siteKey(r))) : add(emptySite(r.part, r.side, r.aspect, {mapId: map?.id, regionId: r.id}))}/> : <p>{t("No body map available. Add sites from the list.")}</p>}
    <p>{t(view?.aspect === "POSTERIOR" ? "Back view: the patient's left is on your left." : "Front view: the patient's right is on your left.")} {t("Click again to remove. Up to 20 sites.")}</p>
  </div><div className="grid gap-3">
    <Select label="Add a site from the list" value={part} options={(codes["body-part"] ?? []).map(c => ({value: c.code, label: c.display}))} onChange={e => setPart(e.target.value)}/>
    {codes["body-part"]?.find(c => c.code === part)?.body?.hasSide === true ? <Select label="Side" value={side} options={["RIGHT", "LEFT", "BILATERAL"].map(v => ({value: v, label: displayCode(codes, "body-side", v)}))} onChange={e => setSide(e.target.value)}/> : null}
    <Button disabled={!part || sites.length >= 20} onClick={() => {add(emptySite(part, codes["body-part"]?.find(c => c.code === part)?.body?.hasSide === true ? side : "CENTRAL")); setPart("");}}>Add site</Button>
    {!sites.length ? <p>{t("No sites marked. Click the painful areas on the body map, or add them from the list.")}</p> : null}
    <ol className="grid gap-3">{sites.map((s, i) => <li key={siteKey(s)} className="grid gap-2 border border-[var(--border)] p-3"><p><b>{t(siteLabel(codes, s))}</b></p><Button variant="ghost" aria-label={t("Remove {site}", {site: siteLabel(codes, s)})} onClick={() => onChange(sites.filter((_, j) => j !== i))}>Remove site</Button>
      {scoreChoices ? <Select label={t("Score at {site}", {site: siteLabel(codes, s)})} value={s.score == null ? "" : String(s.score)} options={scoreChoices.map(n => ({value: String(n), label: format.number(n)}))} onChange={e => update(i, {score: e.target.value === "" ? null : Number(e.target.value)})}/> : null}
      <div role="group" aria-label={t("Character")}>{(codes["pain-character"] ?? []).map(c => <Button key={c.code} variant="ghost" aria-pressed={s.characters.includes(c.code)} onClick={() => update(i, {characters: s.characters.includes(c.code) ? s.characters.filter(x => x !== c.code) : s.characters.length < 5 ? [...s.characters, c.code] : s.characters})}>{c.display}</Button>)}</div>
      <Select label="Pattern" value={s.pattern} options={(codes["pain-pattern"] ?? []).map(c => ({value: c.code, label: c.display}))} onChange={e => update(i, {pattern: e.target.value})}/>
      <Button variant="secondary" aria-pressed={s.radiating} onClick={() => update(i, {radiating: !s.radiating, radiatesTo: s.radiating ? "" : s.radiatesTo})}>Pain spreads</Button>
      {s.radiating ? <Select label="Radiates to" value={s.radiatesTo} options={(codes["body-part"] ?? []).map(c => ({value: c.code, label: c.display}))} onChange={e => update(i, {radiatesTo: e.target.value})}/> : null}
      <Input label="Note for this site" maxLength={300} value={s.note} onChange={e => update(i, {note: e.target.value})}/>
    </li>)}</ol>
  </div></fieldset>;
}
