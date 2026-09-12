import { NextFunction, Request, Response } from "express";
import { AnyZodObject } from "zod";

// Each route passes one schema shaped like { body?, query?, params? } and
// only the parts it actually validates - whatever comes back replaces the
// request's originals so handlers always see parsed, coerced values.
export function validate(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.parse({ body: req.body, query: req.query, params: req.params }) as {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) req.query = parsed.query as typeof req.query;
    if (parsed.params !== undefined) req.params = parsed.params as typeof req.params;
    next();
  };
}
