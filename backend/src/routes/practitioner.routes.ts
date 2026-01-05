import { Router } from 'express';
import { practitionerController } from '../controllers/practitioner.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All practitioner routes require authentication
router.get('/dashboard', authenticate, practitionerController.getDashboard.bind(practitionerController));
router.post('/documents/insurance/upload-url', authenticate, practitionerController.getInsuranceUploadUrl.bind(practitionerController));
router.put('/documents/insurance/confirm', authenticate, practitionerController.confirmInsuranceUpload.bind(practitionerController));
router.get('/documents/insurance', authenticate, practitionerController.getInsuranceDocument.bind(practitionerController));

export default router;

