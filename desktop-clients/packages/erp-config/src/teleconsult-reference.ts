/** Clinic Desk staff and CareCall patient views share one backend, not one permission boundary. */
export const TELECONSULT_REFERENCES = [
 {id:'reference-teleconsult-provider',variant:'teleconsult-provider',title:'Teleconsult Provider',shortLabel:'Provider',accent:'#0F8B8D',pages:[
  {id:'reference-teleconsult-provider-today',path:'/',title:'Today',section:'clinic'},
  {id:'reference-teleconsult-provider-schedule',path:'/schedule',title:'Schedule',section:'clinic'},
  {id:'reference-teleconsult-provider-patients',path:'/patients',title:'Patients',section:'clinic'},
  {id:'reference-teleconsult-provider-notes',path:'/notes',title:'Visit notes',section:'clinic'},
  {id:'reference-teleconsult-provider-consult',path:'/consult/[id]',title:'Consultation',section:'clinic'}
 ]},
 {id:'reference-teleconsult-patient',variant:'teleconsult-patient',title:'Teleconsult Patient',shortLabel:'Patient',accent:'#147D64',pages:[
  {id:'reference-teleconsult-patient-welcome',path:'/',title:'Welcome',section:'care'},
  {id:'reference-teleconsult-patient-register',path:'/register',title:'Registration',section:'care'},
  {id:'reference-teleconsult-patient-home',path:'/home',title:'Home',section:'care'},
  {id:'reference-teleconsult-patient-book',path:'/book',title:'Book a visit',section:'care'},
  {id:'reference-teleconsult-patient-records',path:'/records',title:'My health',section:'care'},
  {id:'reference-teleconsult-patient-visit',path:'/visit/[id]',title:'Visit',section:'care'},
  {id:'reference-teleconsult-patient-summary',path:'/visit/[id]/summary',title:'Visit summary',section:'care'}
 ]}
] as const;
/** Dynamic source pages are accessed through a real record, never a fake sidebar record ID. */
export function sourceRouteMatches(pattern:string,path:string){
 const expected=pattern.split('/').filter(Boolean),actual=path.split('?')[0].split('/').filter(Boolean);
 return expected.length===actual.length&&expected.every((part,index)=>/^\[[a-z]+\]$/.test(part)?!!actual[index]:part===actual[index]);
}
