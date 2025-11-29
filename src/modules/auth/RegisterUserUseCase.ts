import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { IUserRepository } from './IUserRepository';
import { IHashProvider } from '../../shared/providers/HashProvider';
import { AppError } from '../../shared/errors/AppError';

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  role: z.nativeEnum(UserRole).optional(),
});

export type RegisterUserDTO = z.infer<typeof registerSchema>;

export class RegisterUserUseCase {
  constructor(
    private userRepository: IUserRepository,
    private hashProvider: IHashProvider
  ) {}

  async execute(data: RegisterUserDTO) {
    const validatedData = registerSchema.parse(data);

    const userExists = await this.userRepository.findByEmail(validatedData.email);
    if (userExists) {
      throw new AppError('Email já cadastrado', 409);
    }

    const hashedPassword = await this.hashProvider.hash(validatedData.password);

    const user = await this.userRepository.create({
      ...validatedData,
      password: hashedPassword,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}