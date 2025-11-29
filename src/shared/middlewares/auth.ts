import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    throw new UnauthorizedError('Token inválido ou expirado');
  }
}

export function authorize(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    if (!user || !roles.includes(user.role as UserRole)) {
      throw new ForbiddenError('Você não tem permissão para acessar este recurso');
    }
  };
}