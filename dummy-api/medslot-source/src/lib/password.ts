import {randomBytes,scryptSync} from "node:crypto";
// Local scheduling roster only. These hashes never authenticate into the host workspace.
export function hashPassword(value:string){const salt=randomBytes(16).toString("hex");return salt+":"+scryptSync(value,salt,32).toString("hex");}
