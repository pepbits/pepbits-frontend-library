export const surgisuiteRoutes = [
 {path:'/',title:'Theatre board',kind:'board'},
 {path:'/schedule',title:'Schedule',kind:'schedule'},
 {path:'/cases',title:'Cases',kind:'cases'},
 {path:'/approvals',title:'Approvals',kind:'approvals'},
 {path:'/patients',title:'Patients',kind:'patients'},
 {path:'/inventory',title:'Inventory',kind:'inventory'},
 {path:'/analytics',title:'Analytics',kind:'analytics'},
 {path:'/masters',title:'Masters & coding',kind:'masters'},
 {path:'/cases/[id]',title:'Case workspace',kind:'case'},
] as const;
export const surgisuiteNavigation=surgisuiteRoutes.filter(route=>route.kind!=='case');
export function resolveSurgiSuiteRoute(path:string){
 const pathname=path.split('?')[0]!;
 const route=surgisuiteRoutes.find(route=>route.kind!=='case'&&route.path===pathname);
 if(route)return {kind:route.kind};
 const match=/^\/cases\/([1-9]\d*)$/.exec(pathname);
 return match?{kind:'case' as const,id:match[1]}:null;
}
export const surgisuiteRoles=['enterprise-admin','surgisuite-admin','surgisuite-coordinator','surgisuite-surgeon','surgisuite-anesthesia','surgisuite-nurse','surgisuite-approver','surgisuite-coder','surgisuite-viewer'];
