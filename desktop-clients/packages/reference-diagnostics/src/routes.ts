export function matchDiagnosticRoute<T extends {path:string}>(routes:readonly T[],path:string):{route:T;params:Record<string,string>}|null{
 const pathname=path.split(/[?#]/)[0];if(!pathname.startsWith('/')||pathname.startsWith('//'))return null;
 let segments:string[];try{segments=pathname.split('/').filter(Boolean).map(decodeURIComponent);}catch{return null;}
 if(segments.some(s=>s==='.'||s==='..'||s.includes('/')||s.includes('\\')))return null;
 for(const route of [...routes].sort((a,b)=>(a.path.includes('[')?1:0)-(b.path.includes('[')?1:0)||b.path.length-a.path.length)){
  const parts=route.path.split('/').filter(Boolean);if(parts.length!==segments.length)continue;const params:Record<string,string>={};let matches=true;
  parts.forEach((part,i)=>{if(part.startsWith('['))params[part.slice(1,-1)]=segments[i];else if(part!==segments[i])matches=false;});
  if(matches)return {route,params};
 }return null;
}
