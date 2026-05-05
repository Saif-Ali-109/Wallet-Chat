import { Request, Response } from 'express';
import { isFcmConfigured, sendDataNotification } from '../lib/fcm';

export const sendPushNotification = async (req: Request, res: Response) => {
  try {
    if (!isFcmConfigured()) {
      return res.status(500).json({ error: 'FCM is not configured' });
    }

    const { token, title, body, data } = req.body;
    if (!token || !title || !body) {
      return res.status(400).json({ error: 'token, title, and body are required' });
    }

    const messageId = await sendDataNotification({
      token: String(token),
      title: String(title),
      body: String(body),
      data: typeof data === 'object' && data ? data : {},
    });

    return res.status(200).json({ messageId });
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
};

