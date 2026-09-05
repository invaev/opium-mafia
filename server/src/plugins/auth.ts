import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    userId: number;
    telegramId: number;
    isIpad: boolean;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('userId', 0);
  fastify.decorateRequest('telegramId', 0);
  fastify.decorateRequest('isIpad', false);

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        request.log.warn({ url: request.url }, 'Auth rejected: no token');
        return reply.status(401).send({ error: 'Missing authorization token' });
      }

      const decoded = fastify.jwt.verify<{ userId: number; telegramId: number; isIpad?: boolean }>(token);
      request.userId = decoded.userId;
      request.telegramId = decoded.telegramId;
      request.isIpad = decoded.isIpad || false;
    } catch (err) {
      request.log.warn({ url: request.url, error: (err as Error).message }, 'Auth rejected: invalid token');
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
}

export default fp(authPlugin);
