import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function startServer() {
  const app = buildApp();

  try {
    const address = await app.listen({
      port: env.PORT,
      host: env.HOST,
    });
    app.log.info(`🚀 SwasthyaSetu Backend listening on ${address}${env.API_BASE_PATH}/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();
