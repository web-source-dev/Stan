import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);

let connected = false;

export async function connectDb(): Promise<void> {
  if (connected) return;
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  connected = true;

  // Ensure indexes declared on schemas are built. In production this is often
  // handled by a migration step, but for now we build them on boot.
  await mongoose.connection.syncIndexes().catch((err) => {
    logger.warn({ err }, 'syncIndexes failed (non-fatal)');
  });
}

export async function disconnectDb(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}
