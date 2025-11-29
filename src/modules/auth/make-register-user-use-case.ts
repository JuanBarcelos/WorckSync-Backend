import { BCryptHashProvider } from '../../shared/providers/HashProvider';
import { RegisterUserUseCase } from './RegisterUserUseCase';
import { UserRepository } from './UserRepository';

export function makeRegisterUserUseCase() {
  const userRepository = new UserRepository();
  const hashProvider = new BCryptHashProvider();
  const registerUserUseCase = new RegisterUserUseCase(userRepository, hashProvider);

  return registerUserUseCase;
}