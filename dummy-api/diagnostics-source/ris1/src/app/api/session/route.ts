import { currentUser } from '../../../lib/session';
import { ok } from '../../../lib/http';
export function GET(){const user=currentUser();return ok({user,users:[user]});}
