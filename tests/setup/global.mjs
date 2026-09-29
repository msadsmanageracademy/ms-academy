// Starts one in-memory MongoDB for the whole test run (each test file uses its own DB).
import { MongoMemoryServer } from "mongodb-memory-server";

// MongoDB 7.0 is the newest server officially supported by the mongodb@5 driver
const MONGO_VERSION = "7.0.14";

let server;

export async function setup({ provide }) {
  server = await MongoMemoryServer.create({ binary: { version: MONGO_VERSION } });
  provide("mongoUri", server.getUri());
}

export async function teardown() {
  await server?.stop();
}
