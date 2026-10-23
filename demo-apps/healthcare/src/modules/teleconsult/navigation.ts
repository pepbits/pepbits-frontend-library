import {providerRoutes} from './provider/routes';
import {patientRoutes} from './patient/routes';
export const teleconsultMenus=[{id:'reference-teleconsult-provider',title:'Teleconsult Provider'},{id:'reference-teleconsult-patient',title:'Teleconsult Patient'}];
export const teleconsultPages=[...providerRoutes.map(p=>({...p,variant:'provider' as const})),...patientRoutes.map(p=>({...p,variant:'patient' as const}))].map(p=>({...p,id:'teleconsult-'+p.variant+'-'+p.kind,module:'reference-teleconsult-'+p.variant,menu:!p.path.includes('[id]')}));
