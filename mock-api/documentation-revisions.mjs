import { createHash } from 'node:crypto';
export const digest = value => createHash('sha256').update((JSON.stringify(value)??'null')).digest('hex');
export function guideText(guide) {
 return [guide.title,...guide.sections.flatMap(s=>[s.title,...s.paragraphs]),...guide.fields.flatMap(f=>[f.label,f.help,...f.rules]),...guide.tour.flatMap(s=>[s.title,s.text])].filter(Boolean);
}
export function translationRevision(guide, language, translate, records = {}) {
 const sourceHash = digest({pageId:guide.pageId,module:guide.module,revision:guide.revision,title:guide.title,sections:guide.sections,fields:guide.fields,tour:guide.tour}), texts = guideText(guide);
 const values = texts.map(translate), translationHash = digest(values);
 const record = records[guide.pageId]?.[language];
 const missing = language !== 'en' && texts.some((text,i)=>/[a-zA-Z]{3}/.test(text) && values[i]===text);
 const stale = !!record && (record.sourceHash !== sourceHash || record.translationHash !== translationHash);
 return { sourceHash, translationHash, translationStatus: language === 'en' ? 'source' : stale ? 'outdated' : missing ? 'incomplete' : 'current', reviewStatus: language === 'en' ? 'source' : !missing && !stale && record?.reviewer && record?.reviewedAt && record?.reviewEvidence ? 'reviewed' : 'pending' };
}
