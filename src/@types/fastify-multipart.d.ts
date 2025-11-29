// src/@types/fastify-multipart.d.ts
import { MultipartFile, MultipartValue } from '@fastify/multipart';

declare module 'fastify' {
  interface FastifyRequest {
    // Adiciona os métodos que o plugin injeta
    file: (options?: { limits?: { fileSize?: number } }) => Promise<MultipartFile | undefined>;
    files: (options?: { limits?: { fileSize?: number } }) => AsyncIterableIterator<MultipartFile>;
    parts: (options?: { limits?: { fileSize?: number } }) => AsyncIterableIterator<MultipartFile | MultipartValue>;
    saveRequestFiles: (options?: { limits?: { fileSize?: number }; storage?: any }) => Promise<Array<MultipartFile>>;
    cleanRequestFiles: () => Promise<void>;
    tmpUploads: Array<string>;
  }
}