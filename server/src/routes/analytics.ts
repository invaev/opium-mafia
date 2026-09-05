import { FastifyInstance, FastifyRequest } from 'fastify';
import { audit } from '../audit';

export default async function analyticsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    await fastify.authenticate(request, reply);
  });

  fastify.post('/share', async (request: FastifyRequest) => {
    audit({
      action: 'user.share.clicked',
      userId: request.userId,
      ip: request.ip,
      source: 'mini_app',
    });

    return { success: true };
  });
}
