import { BCryptHashProvider } from '../../shared/providers/HashProvider';
import { AuthenticateUserUseCase } from './AuthenticateUserUseCase';
import { UserRepository } from './UserRepository';

export function makeAuthenticateUserUseCase() {
  const userRepository = new UserRepository();
  const hashProvider = new BCryptHashProvider();
  const authenticateUserUseCase = new AuthenticateUserUseCase(userRepository, hashProvider);

  return authenticateUserUseCase;
}