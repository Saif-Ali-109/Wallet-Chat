import { Request, Response, NextFunction } from 'express';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'anonymous';
  const now = Date.now();
  const data = rateLimitMap.get(ip) || { count: 0, lastReset: now };

  if (now - data.lastReset > 60000) {
    data.count = 0;
    data.lastReset = now;
  }

  if (data.count > 100) {
    return res.status(429).send('Too many requests');
  }

  data.count++;
  rateLimitMap.set(ip, data);
  next();
};
