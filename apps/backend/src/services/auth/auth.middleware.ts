import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@gitroom/helpers/auth/auth.service';
import { User } from '@prisma/client';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { UsersService } from '@gitroom/nestjs-libraries/database/prisma/users/users.service';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { HttpForbiddenException } from '@gitroom/nestjs-libraries/services/exception.filter';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';

// Cached auto-user for SKIP_AUTH mode (Tailscale/internal network)
let _skipAuthUser: User | null = null;
let _skipAuthOrg: any = null;

export const removeAuth = (res: Response) => {
  res.cookie('auth', '', {
    domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    ...(!process.env.NOT_SECURED
      ? {
          secure: true,
          httpOnly: true,
          sameSite: 'none',
        }
      : {}),
    expires: new Date(0),
    maxAge: -1,
  });
  res.header('logout', 'true');
};

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private _organizationService: OrganizationService,
    private _userService: UsersService
  ) {}
  async use(req: Request, res: Response, next: NextFunction) {
    // Tailscale/internal network: skip authentication entirely
    if (process.env.SKIP_AUTH === 'true') {
      return this._handleSkipAuth(req, res, next);
    }

    const auth = req.headers.auth || req.cookies.auth;
    if (!auth) {
      throw new HttpForbiddenException();
    }
    try {
      let user = AuthService.verifyJWT(auth) as User | null;
      const orgHeader = req.cookies.showorg || req.headers.showorg;

      if (!user) {
        throw new HttpForbiddenException();
      }

      if (!user.activated) {
        throw new HttpForbiddenException();
      }

      const impersonate = req.cookies.impersonate || req.headers.impersonate;
      if (user?.isSuperAdmin && impersonate) {
        const loadImpersonate = await this._organizationService.getUserOrg(
          impersonate
        );

        if (loadImpersonate) {
          user = loadImpersonate.user;
          user.isSuperAdmin = true;
          delete user.password;

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          req.user = user;

          // @ts-ignore
          loadImpersonate.organization.users =
            loadImpersonate.organization.users.filter(
              (f) => f.userId === user.id
            );
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          req.org = loadImpersonate.organization;
          next();
          return;
        }
      }

      delete user.password;
      const organization = (
        await this._organizationService.getOrgsByUserId(user.id)
      ).filter((f) => !f.users[0].disabled);
      const setOrg =
        organization.find((org) => org.id === orgHeader) || organization[0];

      if (!organization) {
        throw new HttpForbiddenException();
      }

      if (!setOrg.apiKey) {
        await this._organizationService.updateApiKey(setOrg.id);
      }

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      req.user = user;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      req.org = setOrg;
    } catch (err) {
      throw new HttpForbiddenException();
    }
    next();
  }

  /**
   * SKIP_AUTH mode: auto-create a default admin user/org on first request,
   * then authenticate all requests as that user. For Tailscale/VPN deployments.
   */
  private async _handleSkipAuth(req: Request, res: Response, next: NextFunction) {
    if (!_skipAuthUser || !_skipAuthOrg) {
      // Try to find existing user first
      let user = await this._userService.getUserByEmail('admin@internal');
      if (!user) {
        // Auto-create default admin user + organization
        const result = await this._organizationService.createOrgAndUser(
          {
            email: 'admin@internal',
            password: 'skip-auth-not-used',
            provider: 'LOCAL' as any,
            company: 'Internal',
            providerToken: '',
            datafast_visitor_id: '',
          },
          '127.0.0.1',
          'skip-auth'
        );
        user = result.users[0].user;
      }

      // Ensure user is activated
      if (!user.activated) {
        await this._userService.activateUser(user.id);
        user.activated = true;
      }

      const orgs = (
        await this._organizationService.getOrgsByUserId(user.id)
      ).filter((f) => !f.users[0].disabled);

      if (!orgs.length) {
        throw new HttpForbiddenException();
      }

      delete user.password;
      _skipAuthUser = user;
      _skipAuthOrg = orgs[0];

      // Set auth cookie so frontend doesn't redirect to login
      const jwt = AuthService.signJWT(user);
      res.cookie('auth', jwt, {
        domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
        expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        path: '/',
      });
      res.header('auth', jwt);
    }

    // @ts-expect-error
    req.user = _skipAuthUser;
    // @ts-expect-error
    req.org = _skipAuthOrg;
    next();
  }
}
