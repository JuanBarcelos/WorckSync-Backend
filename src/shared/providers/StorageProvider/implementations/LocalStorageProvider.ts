import fs from 'node:fs/promises';
import path from 'node:path';
import { IStorageProvider } from '../IStorageProvider';

export class LocalStorageProvider implements IStorageProvider {
  private tmpFolder = path.resolve(__dirname, '..', '..', '..', '..', 'tmp');

  constructor() {
    // Garante que a pasta tmp existe
    fs.mkdir(this.tmpFolder, { recursive: true }).catch(console.error);
  }

  async save(filename: string, content: Buffer): Promise<string> {
    const filePath = path.join(this.tmpFolder, filename);
    await fs.writeFile(filePath, content);
    return filename;
  }

  async get(filename: string): Promise<Buffer | null> {
    const filePath = path.join(this.tmpFolder, filename);
    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  async delete(filename: string): Promise<void> {
    const filePath = path.join(this.tmpFolder, filename);
    try {
      await fs.unlink(filePath);
    } catch {
      // Arquivo já não existe, ignora
    }
  }
}