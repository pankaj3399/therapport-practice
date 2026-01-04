import { Router } from 'express';
import { practitionerController } from '../controllers/practitioner.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All practitioner routes require authentication
router.get('/dashboard', authenticate, practitionerController.getDashboard.bind(practitionerController));

export default router;

