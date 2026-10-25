import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Db } from '../db/database.service';

export interface SessionUser { id: number; username: string; full_name: string; role: string; department_id: number | null }

export const IS_PUBLIC = 'isPublic';
/** Route does not require a user session (login, integration endpoints secured by API key). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const ROLES = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES, roles);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): SessionUser => ctx.switchToHttp().getRequest().user);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly db: Db, private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException('Authenticated host identity is required');
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES, targets);
    if (roles?.length && req.user.role !== 'ADMIN' && !roles.includes(req.user.role)) {
      throw new ForbiddenException(`This action requires role: ${roles.join(' or ')}`);
    }
    return true;
  }
}
