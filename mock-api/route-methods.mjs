/** One method contract for registered routes; unknown paths remain 404. */
const methods = new Map(Object.entries({
  '/clinical-templates': ['POST'],
  '/auth/login': ['POST'], '/auth/me': ['GET'], '/auth/logout': ['POST'],
  '/draft-center':['POST'], '/drafts':['POST'], '/draft-policy':['GET','PUT'],
  '/records': ['GET'], '/navigation': ['GET'], '/localization': ['GET'],
  '/monitoring/events': ['POST'], '/monitoring/incidents':['GET'],
  '/documentation': ['GET'], '/documentation/state': ['PUT'],
  '/preferences': ['GET','PUT'], '/preference-policy': ['GET','PUT'], '/layouts': ['GET','PUT'], '/ai/policy': ['GET','PUT'],
  '/approvals': ['POST'], '/imports': ['POST'], '/record-panels': ['POST'],
  '/personal-views': ['POST'], '/worklists/archive': ['POST'], '/worklists/search': ['POST'],
  '/exports': ['POST'], '/reference': ['GET'], '/views': ['POST'],
  '/ai/config': ['GET','PUT'], '/ai/config/credential': ['GET','PUT','DELETE'],
  '/ai/config/credential/verify': ['POST'], '/ai/dispatch': ['POST'], '/ai/usage': ['GET'],
  '/health': ['GET'], '/audit': ['GET'], '/report-schedules': ['POST'],
}));
export function allowedMethods(pathname) {
  if (/^\/monitoring\/incidents\/[^/]+$/.test(pathname)) return ['GET','PATCH','OPTIONS'];
  if (methods.has(pathname)) return [...methods.get(pathname), 'OPTIONS'];
  if (/^\/records\/[^/]+$/.test(pathname)) return ['GET','PUT','OPTIONS'];
  if (/^\/records\/[^/]+\/(draft|discard|create)$/.test(pathname)) return ['PUT','OPTIONS'];
  if (/^\/views\/[^/]+$/.test(pathname)) return ['GET','OPTIONS'];
  return null;
}
