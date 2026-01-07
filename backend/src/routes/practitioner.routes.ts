import { Router } from 'express';
import { practitionerController } from '../controllers/practitioner.controller';
import { authenticate } from '../middleware/auth.middleware';
import { checkMarketingAddon } from '../middleware/rbac.middleware';

const router = Router();

// All practitioner routes require authentication
router.get('/dashboard', authenticate, practitionerController.getDashboard.bind(practitionerController));
router.post('/documents/insurance/upload-url', authenticate, practitionerController.getInsuranceUploadUrl.bind(practitionerController));
router.put('/documents/insurance/confirm', authenticate, practitionerController.confirmInsuranceUpload.bind(practitionerController));
router.get('/documents/insurance', authenticate, practitionerController.getInsuranceDocument.bind(practitionerController));

// Clinical routes require authentication + marketing add-on
router.post('/documents/clinical/upload-url', authenticate, checkMarketingAddon, practitionerController.getClinicalUploadUrl.bind(practitionerController));
router.put('/documents/clinical/confirm', authenticate, checkMarketingAddon, practitionerController.confirmClinicalUpload.bind(practitionerController));
router.get('/documents/clinical', authenticate, checkMarketingAddon, practitionerController.getClinicalDocument.bind(practitionerController));
router.post('/clinical-executor', authenticate, checkMarketingAddon, practitionerController.createOrUpdateClinicalExecutor.bind(practitionerController));
router.get('/clinical-executor', authenticate, checkMarketingAddon, practitionerController.getClinicalExecutor.bind(practitionerController));

export default router;

