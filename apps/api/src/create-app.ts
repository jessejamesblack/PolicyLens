import multipart from "@fastify/multipart";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function createDriversLicenseApp(): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: MAX_UPLOAD_BYTES
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  await app.register(multipart as never, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 1
    }
  });

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  app.enableCors({ origin: corsOrigin, credentials: false });
  return app;
}
