import { Router } from 'express';
import { z, ZodError } from 'zod';
import { parseOpenApi, OpenApiParseError } from '../services/openapi-parser.js';
import type {
  OpenApiImportSuccessDto,
  OpenApiImportErrorDto,
} from '@webapi-tester/shared';

export const openapiRouter: ReturnType<typeof Router> = Router();

const importUrlSchema = z.object({
  url: z.string().url(),
});

const importFileSchema = z.object({
  fileContent: z.string().min(1),
});

openapiRouter.post('/openapi/import', async (req, res, next) => {
  try {
    const body = req.body as { url?: unknown; fileContent?: unknown };

    let result;
    if (typeof body.url === 'string') {
      const dto = importUrlSchema.parse(body);
      result = await parseOpenApi({ url: dto.url });
    } else if (typeof body.fileContent === 'string') {
      const dto = importFileSchema.parse(body);
      result = await parseOpenApi({ fileContent: dto.fileContent });
    } else {
      const errDto: OpenApiImportErrorDto = {
        error: 'Bad request',
        details: 'Either url or fileContent is required',
      };
      return res.status(400).json(errDto);
    }

    const success: OpenApiImportSuccessDto = result;
    res.json(success);
  } catch (err) {
    if (err instanceof OpenApiParseError) {
      const errDto: OpenApiImportErrorDto = {
        error: 'OpenAPI parse failed',
        details: err.message,
      };
      return res.status(err.status).json(errDto);
    }
    if (err instanceof ZodError) {
      const errDto: OpenApiImportErrorDto = {
        error: 'Validation failed',
        details: err.issues
          .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
          .join('; '),
      };
      return res.status(400).json(errDto);
    }
    next(err);
  }
});
