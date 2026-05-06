
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongoose: MongooseCache;
}

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
export const JWT_EXPIRES_DAYS = process.env.JWT_EXPIRES_DAYS || '24h';
export const EXPECTED_EVM_CHAIN_ID = Number(process.env.SEPOLIA_CHAIN_ID || 11155111);
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wallet-chat';
export const PORT = Number(process.env.PORT) || 4000;

const globalCache = global.mongoose || { conn: null, promise: null };
global.mongoose = globalCache;

export async function connectDB() {
  if (globalCache.conn) return globalCache.conn;
  if (!globalCache.promise) {
    globalCache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }
  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}
