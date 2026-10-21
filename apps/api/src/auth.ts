import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

function matches(actual: string | undefined, expected: string): boolean {
  if (!actual?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(actual.slice(7));
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

export function requireBearer(expected: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!matches(request.headers.authorization, expected)) return reply.code(401).send({ error: "unauthorized" });
  };
}
