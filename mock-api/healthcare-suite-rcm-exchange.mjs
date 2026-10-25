// Synthetic MockIns transport. Wire shapes follow the Healthcare Enterprise canonical
// schema and MockIns v1 samples; no real payer endpoints or credentials are accepted.
import {createHash} from 'node:crypto';
const NS='urn:pepbits:mockins:v1';
const FORMATS=new Set(['REST_JSON','REST_XML','SOAP11','SOAP12']);
const OPS={CLAIM_SUBMIT:['claims','SubmitClaim','SubmitClaimRequest','SubmitClaimResponse','claimSubmission','claimAck'],ELIGIBILITY:['eligibility','CheckEligibility','EligibilityRequest','EligibilityResponse','eligibilityInquiry','eligibilityResponse'],CLAIM_STATUS:['claim-status','ClaimStatus','ClaimStatusRequest','ClaimStatusResponse','claimStatusInquiry','claimStatusResponse'],REMITTANCE:['remittances','GetRemittance','RemittanceRequest','RemittanceResponse','remittanceInquiry','remittanceResponse']};
export const mockInsFormats=[...FORMATS];
export const mockInsOperations=Object.keys(OPS);
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export const minorDecimal=n=>`${Math.floor(n/100)}.${String(n%100).padStart(2,'0')}`;
export function decimalMinor(value){if(typeof value!=='string'||!/^\d+\.\d{2}$/.test(value))throw Error('Invalid provider money');const n=Number(value.replace('.',''));if(!Number.isSafeInteger(n))throw Error('Unsafe provider money');return n;}
function tag(name,value){return `<ins:${name}>${esc(value)}</ins:${name}>`;}
function priorEobXml(entries){return entries?'<ins:PriorEob>'+entries.map(e=>'<ins:Adjudication>'+Object.entries(e).map(([k,v])=>tag(k[0].toUpperCase()+k.slice(1),v)).join('')+'</ins:Adjudication>').join('')+'</ins:PriorEob>':'';}
export function freezeMockInsRequest(profile,operation,c){
 const op=OPS[operation];if(!op||!FORMATS.has(profile.wireFormat))throw Error('Unknown MockIns operation or format');
 let body;
 if(profile.wireFormat==='REST_JSON')body=JSON.stringify({[op[4]]:c});
 else {
  const sender=`<ins:Sender id="${esc(c.sender.id)}" provider="${esc(c.sender.providerId)}"/>`,payer=`<ins:Payer code="${esc(c.payerCode)}"/>`;
  let payload;
  if(operation==='CLAIM_SUBMIT')payload=tag('SubmissionId',c.submissionId)+sender+payer+`<ins:Claim controlNumber="${esc(c.patientControlNumber)}" version="${c.claimVersion}" frequency="${c.frequencyCode}">`+`<ins:Subscriber>${tag('MemberId',c.subscriber.memberId)}${c.subscriber.policyNumber?tag('PolicyNumber',c.subscriber.policyNumber):''}</ins:Subscriber>`+(c.priorPayerClaimId?tag('PriorPayerClaimId',c.priorPayerClaimId):'')+tag('Currency',c.currencyCode)+tag('TotalCharge',c.totalChargeAmount)+`<ins:ServicePeriod from="${esc(c.serviceDates.from)}" to="${esc(c.serviceDates.to)}"/><ins:Lines>`+c.serviceLines.map(l=>`<ins:Line control="${esc(l.lineControl)}" number="${l.lineNumber}">${tag('Procedure',l.procedureCode)}${tag('ServiceDate',l.serviceDate)}${tag('Units',l.units)}${tag('Charge',l.chargeAmount)}${priorEobXml(l.priorEob)}</ins:Line>`).join('')+`</ins:Lines>${c.payerLevel?tag('PayerLevel',c.payerLevel):''}</ins:Claim>`;
  else if(operation==='ELIGIBILITY')payload=tag('InquiryId',c.inquiryId)+sender+payer+`<ins:Subscriber>${tag('MemberId',c.subscriber.memberId)}</ins:Subscriber>`+tag('ServiceDate',c.serviceDate)+tag('ServiceType',c.serviceTypeCode);
  else if(operation==='CLAIM_STATUS')payload=tag('InquiryId',c.inquiryId)+sender+payer+tag('SubmissionId',c.submissionId)+(c.payerClaimId?tag('PayerClaimId',c.payerClaimId):'')+tag('ClaimVersion',c.claimVersion);
  else payload=tag('QueryId',c.queryId)+sender+payer+(c.remittanceId?tag('RemittanceId',c.remittanceId):'')+(c.cursor?tag('Cursor',c.cursor):'');
  body=`<ins:${op[2]} xmlns:ins="${NS}">${payload}</ins:${op[2]}>`;
  if(profile.wireFormat.startsWith('SOAP'))body=`<soap:Envelope xmlns:soap="${profile.wireFormat==='SOAP11'?'http://schemas.xmlsoap.org/soap/envelope/':'http://www.w3.org/2003/05/soap-envelope'}"><soap:Body>${body}</soap:Body></soap:Envelope>`;
 }
 const soap=profile.wireFormat.startsWith('SOAP'),action=`${NS}#${op[1]}`;
 return {path:soap?`/ins/v1/${profile.wireFormat.toLowerCase()}`:`/ins/v1/${profile.wireFormat==='REST_JSON'?'json':'xml'}/${op[0]}`,body,contentType:profile.wireFormat==='REST_JSON'?'application/json':profile.wireFormat==='REST_XML'?'application/xml':profile.wireFormat==='SOAP11'?'text/xml':`application/soap+xml; action="${action}"`,...(profile.wireFormat==='SOAP11'?{soapAction:`"${action}"`}:{}),digest:createHash('sha256').update(body).digest('hex')};
}
// A bounded XML subset parser: no declarations, entities, processing instructions,
// unresolved namespaces, duplicate attributes, mixed content or malformed envelopes.
function parseXml(xml){
 if(/<!|<\?(?!xml\s)/i.test(xml))throw Error('Unsafe provider XML');
 xml=xml.replace(/^<\?xml[^?]*\?>\s*/,'');
 const tokens=xml.match(/<[^>]*>|[^<]+/g)??[];if(tokens.join('')!==xml)throw Error('Malformed provider XML');
 const stack=[];let root;
 const decode=s=>s.replace(/&([^;]+);/g,(_,e)=>{const map={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(!(e in map))throw Error('Unsupported XML entity');return map[e];});
 for(const t of tokens){
  if(!t.startsWith('<')){if(stack.length)stack.at(-1).text+=decode(t);else if(t.trim())throw Error('Unexpected XML text');continue;}
  if(t.startsWith('</')){const q=t.slice(2,-1).trim();if(!stack.length||stack.at(-1).q!==q)throw Error('Unbalanced provider XML');stack.pop();continue;}
  const m=t.match(/^<([\w:.-]+)([\s\S]*?)(\/?)>$/);if(!m||stack.length>32)throw Error('Malformed provider XML');
  const attrs={};let tail=m[2];while(tail.trim()){
   const a=tail.match(/^\s+([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/);if(!a||a[1] in attrs)throw Error('Malformed XML attribute');attrs[a[1]]=decode(a[2]??a[3]);tail=tail.slice(a[0].length);
  }
  const namespaces={...(stack.at(-1)?.namespaces??{})};for(const [k,v]of Object.entries(attrs))if(k==='xmlns')namespaces['']=v;else if(k.startsWith('xmlns:'))namespaces[k.slice(6)]=v;
  const parts=m[1].split(':');const node={q:m[1],name:parts.at(-1),ns:namespaces[parts.length===2?parts[0]:''],attrs,text:'',children:[],namespaces};if(!node.ns)throw Error('Unknown XML namespace');
  if(stack.length)stack.at(-1).children.push(node);else{if(root)throw Error('Multiple XML roots');root=node;}if(!m[3])stack.push(node);
 }
 if(stack.length||!root)throw Error('Incomplete provider XML');return root;
}
const one=(node,name,required=true)=>{const rows=node.children.filter(n=>n.name===name);if(rows.length>1||required&&!rows.length)throw Error(`Invalid provider ${name}`);return rows[0];};
const val=(node,name,required=true)=>{const n=one(node,name,required);return n?.text.trim();};
function xmlResponse(format,operation,xml){
 let root=parseXml(xml);if(format.startsWith('SOAP')){const ns=format==='SOAP11'?'http://schemas.xmlsoap.org/soap/envelope/':'http://www.w3.org/2003/05/soap-envelope';if(root.name!=='Envelope'||root.ns!==ns)throw Error('Wrong SOAP envelope');const header=one(root,'Header',false);if(header?.children.length)throw Error('Unsupported SOAP headers');const body=one(root,'Body');if(body.children.length!==1)throw Error('Invalid SOAP body');root=body.children[0];}
 if(root.ns!==NS||root.name!==OPS[operation][3])throw Error('Wrong provider operation');
 function checkNamespaces(n){if(n.ns!==NS)throw Error('Unknown payload namespace');if(n.children.length&&n.text.trim())throw Error('Mixed provider XML');n.children.forEach(checkNamespaces);}checkNamespaces(root);
 if(operation==='CLAIM_SUBMIT')return {submissionId:val(root,'SubmissionId'),payerClaimId:val(root,'PayerClaimId',false),claimVersion:Number(val(root,'ClaimVersion')),currencyCode:val(root,'Currency'),totalChargeAmount:val(root,'TotalCharge'),ackStatus:val(root,'Status'),lineAcks:(one(root,'Lines',false)?.children??[]).map(n=>({lineControl:n.attrs.control,status:n.attrs.status,reasonCode:n.attrs.reason})),rejections:(one(root,'Rejections',false)?.children??[]).map(n=>({code:n.attrs.code,message:n.text}))};
 if(operation==='ELIGIBILITY'){const sub=one(root,'Subscriber');return {inquiryId:val(root,'InquiryId'),subscriber:{memberId:val(sub,'MemberId')},coverageStatus:val(root,'CoverageStatus'),planCode:one(root,'Plan',false)?.attrs.code};}
 if(operation==='CLAIM_STATUS'){const status=one(root,'Status');return {inquiryId:val(root,'InquiryId'),submissionId:val(root,'SubmissionId'),payerClaimId:val(root,'PayerClaimId',false),claimVersion:Number(val(root,'ClaimVersion')),statusCode:status.attrs.code};}
 return {queryId:val(root,'QueryId'),nextCursor:val(root,'NextCursor',false),advices:(one(root,'Advices',false)?.children??[]).map(a=>({remittanceId:a.attrs.id,payerCode:one(a,'Payer').attrs.code,payment:{traceNumber:one(a,'Payment').attrs.trace,method:one(a,'Payment').attrs.method,date:one(a,'Payment').attrs.date},currencyCode:val(a,'Currency'),totalPaidAmount:val(a,'TotalPaid'),claims:one(a,'Claims').children.map(c=>({submissionId:c.attrs.submissionId,payerClaimId:c.attrs.payerClaimId,claimVersion:Number(c.attrs.version),patientControlNumber:c.attrs.controlNumber,statusCode:c.attrs.status,totalChargeAmount:val(c,'TotalCharge'),totalPaidAmount:val(c,'TotalPaid'),lines:one(c,'Lines').children.map(l=>({lineControl:l.attrs.control,statusCode:l.attrs.status,allowedAmount:val(l,'Allowed',false),chargeAmount:val(l,'Charge'),paidAmount:val(l,'Paid'),adjustments:(one(l,'Adjustments',false)?.children??[]).map(j=>({groupCode:j.attrs.group,reasonCode:j.attrs.reason,amount:j.attrs.amount}))}))}))}))};
}
export async function dispatchMockIns(provider,profile,exchange,identity){
 if(!provider?.baseUrl||!provider?.apiKey)throw Error('MockIns provider is not configured');
 const endpoint=new URL(provider.baseUrl);if(endpoint.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw Error('MockIns must use a loopback HTTP origin');
 const headers={'Content-Type':exchange.wire.contentType,'Authorization':`Bearer ${provider.apiKey}`,'X-Tenant-ID':identity.tenant,'X-Sender-ID':identity.sender,'Idempotency-Key':exchange.id};if(exchange.wire.soapAction)headers.SOAPAction=exchange.wire.soapAction;
 if(!/^\/ins\/v1\/(json\/(claims|eligibility|claim-status|remittances)|xml\/(claims|eligibility|claim-status|remittances)|soap11|soap12)$/.test(exchange.wire.path))throw Error('Invalid MockIns route');
 const target=new URL(exchange.wire.path,endpoint);if(target.origin!==endpoint.origin)throw Error('Invalid MockIns origin');
 const response=await(provider.fetch??fetch)(target,{method:'POST',headers,body:exchange.wire.body,signal:AbortSignal.timeout(provider.timeoutMs??5000),redirect:'error'});
 if(!response.ok)throw Error(`MockIns HTTP ${response.status}`);
 const contentType=response.headers.get('content-type')??'';const expected=exchange.wire.contentType.split(';')[0];if(!contentType.toLowerCase().startsWith(expected))throw Error('Wrong provider Content-Type');
 const reader=response.body.getReader();let bytes=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>131072){await reader.cancel();throw Error('Provider response too large');}chunks.push(value);}const raw=Buffer.concat(chunks).toString('utf8');
 let payload;if(profile.wireFormat==='REST_JSON'){const object=JSON.parse(raw);if(!object||Array.isArray(object)||Object.keys(object).length!==1)throw Error('Wrong provider envelope');payload=object[OPS[exchange.operation][5]];if(!payload||Array.isArray(payload))throw Error('Wrong provider operation');}else payload=xmlResponse(profile.wireFormat,exchange.operation,raw);
 const c=exchange.canonical,op=exchange.operation;
 if(op==='CLAIM_SUBMIT'){
  if(payload.submissionId!==c.submissionId||payload.claimVersion!==c.claimVersion||payload.currencyCode!==c.currencyCode||payload.totalChargeAmount!==c.totalChargeAmount||!['A','R','P'].includes(payload.ackStatus))throw Error('Provider claim correlation failed');
  if(payload.ackStatus==='A'&&!payload.payerClaimId)throw Error('Missing payer claim identifier');
  if(!Array.isArray(payload.lineAcks)||payload.lineAcks.length!==c.serviceLines.length||new Set(payload.lineAcks.map(l=>l.lineControl)).size!==payload.lineAcks.length||payload.lineAcks.some(l=>!c.serviceLines.some(r=>r.lineControl===l.lineControl)||!['A','R'].includes(l.status)))throw Error('Provider claim line correlation failed');
 }else if(op==='ELIGIBILITY'){if(payload.inquiryId!==c.inquiryId||!payload.subscriber||payload.subscriber.memberId!==c.subscriber.memberId||!['1','6','U'].includes(payload.coverageStatus))throw Error('Provider eligibility correlation failed');}
 else if(op==='CLAIM_STATUS'){if(payload.inquiryId!==c.inquiryId||payload.submissionId!==c.submissionId||payload.claimVersion!==c.claimVersion||!['RCV','PND','ADJ','DEN','RJT','NF'].includes(payload.statusCode))throw Error('Provider status correlation failed');}
 else {if(payload.queryId!==c.queryId||!Array.isArray(payload.advices))throw Error('Provider remittance correlation failed');for(const a of payload.advices){if(a.payerCode!==c.payerCode||!Array.isArray(a.claims))throw Error('Provider payer mismatch');decimalMinor(a.totalPaidAmount);}}
 return {payload,responseDigest:createHash('sha256').update(raw).digest('hex')};
}
