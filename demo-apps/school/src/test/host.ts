import {readFileSync} from 'node:fs';
export const catalogs=Object.fromEntries(['en','ar'].map(language=>[language,JSON.parse(readFileSync(process.cwd()+`/../../mock-api/config/localization/shared/${language}.json`,'utf8')).messages]));
export const sharedMessages=catalogs.en;
