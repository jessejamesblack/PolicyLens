import "reflect-metadata";
import awsLambdaFastify from "@fastify/aws-lambda";
import { Handler } from "aws-lambda";
import { createDriversLicenseApp } from "./create-app";
import { DocumentsService } from "./documents/documents.service";

let cachedHandler: Handler | undefined;
let cachedApp: Awaited<ReturnType<typeof createDriversLicenseApp>> | undefined;

async function bootstrap(): Promise<Handler> {
  const app = await bootstrapApp();
  const fastifyApp = app.getHttpAdapter().getInstance();
  const proxy = awsLambdaFastify(fastifyApp as never) as Handler;
  return proxy;
}

async function bootstrapApp() {
  if (!cachedApp) {
    cachedApp = await createDriversLicenseApp();
    await cachedApp.init();
  }

  return cachedApp;
}

export const handler: Handler = async (event, context, callback) => {
  if (isSqsEvent(event)) {
    const app = await bootstrapApp();
    const documentsService = app.get(DocumentsService);

    for (const record of event.Records) {
      const body = JSON.parse(record.body) as { documentId?: string };

      if (!body.documentId) {
        throw new Error("Processing queue message did not include documentId.");
      }

      await documentsService.processWithRetry(body.documentId);
    }

    return {
      batchItemFailures: []
    };
  }

  cachedHandler ??= await bootstrap();
  return cachedHandler(event, context, callback);
};

function isSqsEvent(event: unknown): event is { Records: Array<{ body: string; eventSource: string }> } {
  return (
    Boolean(event) &&
    typeof event === "object" &&
    Array.isArray((event as { Records?: unknown }).Records) &&
    (event as { Records: Array<{ eventSource?: string }> }).Records.some(
      (record) => record.eventSource === "aws:sqs"
    )
  );
}
