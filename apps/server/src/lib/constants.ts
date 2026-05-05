
import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
export const JWT_EXPIRES_DAYS = process.env.JWT_EXPIRES_DAYS || '24h';
export const EXPECTED_EVM_CHAIN_ID = Number(process.env.SEPOLIA_CHAIN_ID || 11155111);
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wallet-chat';
export const PORT = Number(process.env.PORT) || 4000;
