import { Request, Response } from 'express';
import { isFcmConfigured, sendDataNotification } from '../lib/fcm';
import { User } from '../models/User';
import { ChatRequest } from '../models/ChatRequest';

export const sendPushNotification = async (req: any, res: Response) => {
  try {
    if (!isFcmConfigured()) {
      return res.status(500).json({ error: 'FCM is not configured' });
    }

    const { token, title, body, data } = req.body;
    if (!token || !title || !body) {
      return res.status(400).json({ error: 'token, title, and body are required' });
    }

    const senderId = req.user?.id;
    if (!senderId) {
      return res.status(401).json({ error: 'Unauthorized: No valid session' });
    }

    // Find the target user by FCM token
    const targetUser = await User.findOne({ fcmToken: String(token) });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found for this device token' });
    }

    // Check if sender and target have an accepted chat connection
    const chatConnection = await ChatRequest.findOne({
      $or: [
        { from: senderId, to: targetUser._id, status: 'accepted' },
        { from: targetUser._id, to: senderId, status: 'accepted' },
      ],
    });

    if (!chatConnection) {
      return res.status(403).json({ error: 'Notifications can only be sent to users with an accepted chat connection' });
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

