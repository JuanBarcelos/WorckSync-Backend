import { prisma } from '../../shared/lib/prisma'; // Importa o Singleton criado acima
import { IUserRepository, CreateUserDTO, UpdateUserDTO } from './IUserRepository';

export class UserRepository implements IUserRepository {
  async create(data: CreateUserDTO) {
    return prisma.user.create({ data });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, data: UpdateUserDTO) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await prisma.user.delete({ where: { id } });
  }

  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        // Seleção explícita para performance e segurança
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count(),
    ]);

    return { users, total };
  }
}