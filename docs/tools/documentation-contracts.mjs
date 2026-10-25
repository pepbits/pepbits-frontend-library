import {digest} from '../../mock-api/documentation-revisions.mjs';
export function assessReceipt(receipt,hash,pages,guides){
 if(!receipt||receipt.sha256!==hash)return 'source changed without an impact receipt';
 if(JSON.stringify(receipt.pages)!==JSON.stringify(pages))return 'affected page mapping changed';
 if(!receipt.reason?.trim()||!['updated','no-content-impact'].includes(receipt.disposition))return 'missing documentation impact explanation';
 if(receipt.disposition==='updated'&&(pages.includes('*')?Object.keys(guides):pages).some(id=>receipt.guideHashes?.[id]!==digest(guides[id])))return 'updated guide fingerprint does not match';
 return null;
}
