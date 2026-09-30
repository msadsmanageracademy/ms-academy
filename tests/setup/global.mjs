// Starts one in-memory MongoDB for the whole test run (each test file uses its own DB).
// It is a single-node replica set because transactions need one (like Atlas in production).
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Same binary as before (already cached); supported by the mongodb@6 driver
const MONGO_VERSION = "7.0.14";

let replSet;

export async function setup({ provide }) {
  replSet = await MongoMemoryReplSet.create({
    binary: { version: MONGO_VERSION },
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  provide("mongoUri", replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}
