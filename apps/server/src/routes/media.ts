import { Router } from 'express';
import { signDownloadUrl, signUploadUrl, proxyUpload } from '../controllers/media.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_MEDIA_FILE_BYTES || 25 * 1024 * 1024)
  }
});

router.post('/sign-upload', authenticateToken, signUploadUrl);
router.post('/sign-download', authenticateToken, signDownloadUrl);
router.post('/upload', authenticateToken, upload.single('file'), proxyUpload);

export default router;

