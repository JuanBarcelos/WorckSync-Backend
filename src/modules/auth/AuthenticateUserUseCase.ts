import { z } from 'zod';
import { IUserRepository } from './IUserRepository';
import { IHashProvider } from '../../shared/providers/HashProvider';
import { UnauthorizedError } from '../../shared/errors/AppError';

const authenticateSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export type AuthenticateUserDTO = z.infer<typeof authenticateSchema>;

export class AuthenticateUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private hashProvider: IHashProvider
  ) {}

  async execute(data: AuthenticateUserDTO) {
    const validatedData = authenticateSchema.parse(data);

    const user = await this.userRepository.findByEmail(validatedData.email);
    if (!user) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Usuário inativo');
    }

    const passwordMatch = await this.hashProvider.compare(
      validatedData.password,
      user.password
    );

    if (!passwordMatch) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}