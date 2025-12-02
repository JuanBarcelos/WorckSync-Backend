import { IStorageProvider } from "../IStorageProvider";

export class MemoryStorageProvider implements IStorageProvider {
  private storage = new Map<string, Buffer>();

  async save(filename: string, content: Buffer): Promise<string> {
    this.storage.set(filename, content);
    return filename;
  }

  async get(filename: string): Promise<Buffer | null> {
    return this.storage.get(filename) || null;
  }

  async delete(filename: string): Promise<void> {
    this.storage.delete(filename);
  }
}
