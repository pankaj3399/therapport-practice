import { Router } from 'express';
import { cronController } from '../controllers/cron.controller';

const router = Router();

// Cron endpoint - no authentication middleware, uses header-based security
router.post('/process-reminders', cronController.processReminders.bind(cronController));
router.get('/process-reminders', cronController.processReminders.bind(cronController));

export default router;

