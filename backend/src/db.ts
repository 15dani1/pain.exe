import { MongoClient } from "mongodb";
import { config } from "./config.js";

let client: MongoClient | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableMongoError(error: unknown) {
  const text = String(error).toLowerCase();
  return (
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("querysrv etimeout") ||
    text.includes("server selection timed out")
  );
}

async function resetClient() {
  if (!client) return;
  try {
    await client.close();
  } catch {
    // Ignore close errors; we'll create a fresh client next time.
  } finally {
    client = null;
  }
}

export async function getDb() {
  if (!config.mongoUri) {
    throw new Error("MONGODB_URI is missing. Set it in backend/.env.");
  }

  if (!client) {
    client = new MongoClient(config.mongoUri, {
      // Atlas can intermittently fail on some networks if IPv6 is preferred.
      // Force IPv4 and fail fast so local debugging is clearer.
      family: 4,
      tls: true,
      serverSelectionTimeoutMS: 15_000,
      connectTimeoutMS: 15_000,
      socketTimeoutMS: 30_000
    });

    try {
      await client.connect();
    } catch (error) {
      await resetClient();
      throw new Error(
        `Mongo connection failed. Confirm Atlas Network Access, DB user credentials, URI encoding, and VPN/firewall settings. Original error: ${String(error)}`
      );
    }
  }

  return client.db(config.mongoDbName);
}

export async function withMongoRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 1;
  let lastError: unknown;

  while (attempt <= maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const shouldRetry = isRetryableMongoError(error) && attempt < maxAttempts;
      if (!shouldRetry) {
        throw error;
      }

      await resetClient();
      await sleep(300 * attempt);
      attempt += 1;
    }
  }

  throw lastError;
}
