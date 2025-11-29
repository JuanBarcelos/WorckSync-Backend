import { User, UserRole } from '@prisma/client';

export interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserDTO {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

// Tipo auxiliar para retorno sem dados sensíveis
export type UserProfileDTO = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface IUserRepository {
  create(data: CreateUserDTO): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, data: UpdateUserDTO): Promise<User>;
  delete(id: string): Promise<void>;
  // Retorna o DTO seguro, não a entidade completa com senha
  list(page: number, limit: number): Promise<{ users: UserProfileDTO[]; total: number }>;
}