import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

export interface IHashProvider {
  hash(payload: string): Promise<string>;
  compare(payload: string, hashed: string): Promise<boolean>;
}

export class BCryptHashProvider implements IHashProvider {
  async hash(payload: string): Promise<string> {
    return bcrypt.hash(payload, env.BCRYPT_SALT_ROUNDS);
  }

  async compare(payload: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(payload, hashed);
  }
}