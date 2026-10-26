/** Production demo ports match each demo README. API overrides use API_PORT. */
export const demos = Object.freeze({showcase:3300, healthcare:3310, erp:3320, school:3340, reports:3350, 'tenant-admin':3360, onboarding:3370, settle:3380, caregrid:3390, 'allyvora-patients':3400, desktop:3410});
export const aliases = Object.freeze({web:'showcase', nexora:'erp', vantage:'erp'});
export const prefix = name => name.toUpperCase().replaceAll('-', '_');
export const services = ['api', ...Object.keys(demos)];
export function servicePort(name, env=process.env) {
  const port=Number(env[prefix(name)+'_PORT'] ?? (name==='api'?3200:demos[name]));
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port for '+name);
  return port;
}

export const hostApiVariable = name => ({settle:'SETTLE_HOST_API_URL', 'allyvora-patients':'ALLYVORA_HOST_API_URL'}[name] ?? prefix(name)+'_API_URL');
export function demoBuildEnv(env=process.env){return {...env,
  NEXT_PUBLIC_API_URL:env.NEXT_PUBLIC_API_URL??'/api', VITE_API_URL:env.VITE_API_URL??'/api',
  NEXT_PUBLIC_SETTLE_API_URL:env.NEXT_PUBLIC_SETTLE_API_URL??'/settle-api',
  NEXT_PUBLIC_CAREGRID_API_URL:env.NEXT_PUBLIC_CAREGRID_API_URL??'/caregrid-api',
  NEXT_PUBLIC_ALLYVORA_API_URL:env.NEXT_PUBLIC_ALLYVORA_API_URL??'/allyvora-api'};}
