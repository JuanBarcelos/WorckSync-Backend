import '@fastify/jwt';
import { UserRole } from '@prisma/client';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: UserRole;
      iat: number;
      exp: number;
    };
    user: {
      sub: string;
      role: UserRole;
      iat: number;
      exp: number;
    };
  }
}