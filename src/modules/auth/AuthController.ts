import { FastifyRequest, FastifyReply } from 'fastify';
import { makeRegisterUserUseCase } from './make-register-user-use-case';
import { makeAuthenticateUserUseCase } from './make-authenticate-user-use-case';
import { UserRepository } from './UserRepository';

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    // A validação dos dados será feita pelo Zod no routes.ts, 
    // então aqui o body já está tipado e seguro.
    const { email, name, password, role } = request.body as any; // O 'as any' aqui é seguro se usar o Zod Provider, ou pode tipar manualmente

    const registerUseCase = makeRegisterUserUseCase();
    
    const user = await registerUseCase.execute({
      email,
      name,
      password,
      role
    });
    
    return reply.status(201).send({ user });
  }

  async authenticate(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = request.body as any;

    const authenticateUseCase = makeAuthenticateUserUseCase();
    
    const user = await authenticateUseCase.execute({
      email,
      password
    });

    const token = await reply.jwtSign(
      {
        sub: user.id,
        role: user.role,
      },
      {
        sign: {
          expiresIn: '7d',
        },
      }
    );

    return reply.send({
      user,
      token,
    });
  }

  async profile(request: FastifyRequest, reply: FastifyReply) {
    const userRepository = new UserRepository();
    const userId = request.user.sub;
    
    const user = await userRepository.findById(userId);

    if (!user) {
      return reply.status(404).send({ message: 'Usuário não encontrado' });
    }

    // Retorno manual para garantir que a senha não vaze, 
    // caso o findById retorne o objeto completo
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  }
}