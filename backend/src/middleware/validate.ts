import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, infer as ZodInfer } from 'zod';

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

/**
 * Validates and coerces request parts against zod schemas. Parsed (typed,
 * stripped) values replace the originals so handlers consume clean input.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        // req.query has only a getter in Express 5; mutate in place.
        Object.keys(req.query).forEach((k) => delete (req.query as Record<string, unknown>)[k]);
        Object.assign(req.query as Record<string, unknown>, parsed);
      }
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export type Body<T extends ZodTypeAny> = ZodInfer<T>;
