import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { sendPushNotification } from '../controllers/notification.controller';

const router = Router();

router.post('/send', authenticateToken, sendPushNotification);

export default router;

