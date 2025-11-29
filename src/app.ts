import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { ZodError } from 'zod';
import { 
  serializerCompiler, 
  validatorCompiler 
} from 'fastify-type-provider-zod';

import { env } from './config/env';
import { AppError } from './shared/errors/AppError';

// Importação das Rotas (Ajuste os caminhos se necessário)
import { authRoutes } from './modules/auth/routes';
import { employeeRoutes } from './modules/employees/routes';
import { shiftRoutes } from './modules/shifts/routes';
import { importRoutes } from './modules/imports/routes';
import { processingRoutes } from './modules/processing/routes';
import { occurrenceRoutes } from './modules/occurrences/routes';
import { reportRoutes } from './modules/reports/routes';
import { timeRecordRoutes } from './modules/timeRecords/routes';

export const app = fastify({
  logger: env.NODE_ENV === 'development',
  bodyLimit: 10485760, // 10MB
});

// Configuração do Zod (Essencial)
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Plugins
app.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH']
});

app.register(jwt, {
  secret: env.JWT_SECRET,
});

// app.register(fastifyStatic, {
//   root: path.join(process.cwd(), 'reports'),
//   prefix: '/reports/',
// });

// Handler de Erros Global
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Erro de validação nos dados enviados.',
      issues: error.format(),
    });
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      message: error.message,
    });
  }

  if (env.NODE_ENV !== 'production') {
    console.error(error);
  }

  return reply.status(500).send({
    message: 'Erro interno do servidor.',
  });
});

// Registro de Rotas
app.register(authRoutes, { prefix: '/api/auth' });
app.register(employeeRoutes, { prefix: '/api/employees' });
app.register(shiftRoutes, { prefix: '/api/shifts' });
app.register(importRoutes, { prefix: '/api/imports' });
app.register(processingRoutes, { prefix: '/api/processing' });
app.register(occurrenceRoutes, { prefix: '/api/occurrences' });
app.register(reportRoutes, { prefix: '/api/reports' });
app.register(timeRecordRoutes, { prefix: '/api/timerecords' });

// Health Check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});