import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthController } from './AuthController';
import { authenticate, authorize } from '../../shared/middlewares/auth';

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  // Adiciona o provider de tipagem Zod
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Rota Pública - Register
  typedApp.post('/register', {
    schema: {
      summary: 'Registrar novo usuário',
      tags: ['Auth'],
      body: z.object({
        name: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(['ADMIN', 'USER', 'MEMBER']).optional(), // Ajuste conforme seu ENUM no Prisma
      }),
      response: {
        201: z.object({
          user: z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            role: z.string(),
          })
        })
      }
    }
  }, authController.register);

  // Rota Pública - Login
  typedApp.post('/login', {
    schema: {
      summary: 'Autenticar usuário',
      tags: ['Auth'],
      body: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    }
  }, authController.authenticate);

  // Rotas Protegidas
  typedApp.get('/profile', {
    preHandler: [authenticate],
    schema: {
      summary: 'Obter perfil do usuário logado',
      tags: ['User']
    }
  }, authController.profile);
  
  // Rota Admin
  typedApp.post('/users', {
    preHandler: [authenticate, authorize('ADMIN')],
    schema: {
      body: z.object({
        name: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(['ADMIN', 'USER', 'MEMBER']).optional(),
      })
    }
  }, authController.register);
}