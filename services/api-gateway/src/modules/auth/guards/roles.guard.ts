import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: User role not identified');
    }

    // Convert role to uppercase string check
    const userRoleStr = String(user.role).toUpperCase();

    // SUPER_ADMIN has master access to all admin routes
    if (userRoleStr === 'SUPER_ADMIN') {
      return true;
    }

    const hasRole = requiredRoles.some((role) => role.toUpperCase() === userRoleStr);
    if (!hasRole) {
      throw new ForbiddenException(`Access denied: Requires one of [${requiredRoles.join(', ')}] roles`);
    }

    return true;
  }
}
