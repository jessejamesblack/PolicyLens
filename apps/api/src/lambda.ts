import "reflect-metadata";
import awsLambdaFastify from "@fastify/aws-lambda";
import { Handler } from "aws-lambda";
import { createDriversLicenseApp } from "./create-app";

let cachedHandler: Handler | undefined;

async function bootstrap(): Promise<Handler> {
  const app = await createDriversLicenseApp();
  const fastifyApp = app.getHttpAdapter().getInstance();
  const proxy = awsLambdaFastify(fastifyApp as never) as Handler;
  await app.init();
  return proxy;
}

export const handler: Handler = async (event, context, callback) => {
  cachedHandler ??= await bootstrap();
  return cachedHandler(event, context, callback);
};
