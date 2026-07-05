import "reflect-metadata";
import { createDriversLicenseApp } from "./create-app";

async function bootstrap() {
  const app = await createDriversLicenseApp();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`DriversLicENSe API listening on http://localhost:${port}`);
}

void bootstrap();
