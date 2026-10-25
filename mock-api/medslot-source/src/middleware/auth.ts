import type {Request,Response,NextFunction} from "express";
import {HttpError} from "../lib/http.js";
export type Role="admin"|"scheduler"|"provider";
export interface AuthUser{id:number;name:string;email:string;role:Role;resource_id:number|null}
declare global {namespace Express {interface Request{user?:AuthUser}} var __accessHostActor:AuthUser|undefined;}
export function requireAuth(req:Request,_res:Response,next:NextFunction){const actor=globalThis.__accessHostActor;if(!actor)throw new HttpError(401,"Please sign in");req.user=actor;next();}
export const requireRole=(...roles:Role[])=>(req:Request,_res:Response,next:NextFunction)=>{if(!req.user||!roles.includes(req.user.role))throw new HttpError(403,"You don't have permission to do this");next();};
