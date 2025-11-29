export interface IStorageProvider {
  save(filename: string, content: Buffer): Promise<string>;
  get(filename: string): Promise<Buffer | null>;
  delete(filename: string): Promise<void>;
}