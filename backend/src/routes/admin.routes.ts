import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

// All admin routes require authentication and admin role
router.get(
  '/stats',
  authenticate,
  requireRole('admin'),
  adminController.getAdminStats.bind(adminController)
);

router.get(
  '/practitioners',
  authenticate,
  requireRole('admin'),
  adminController.getPractitioners.bind(adminController)
);

router.get(
  '/practitioners/missing-info',
  authenticate,
  requireRole('admin'),
  adminController.getPractitionersWithMissingInfo.bind(adminController)
);

router.get(
  '/practitioners/:userId',
  authenticate,
  requireRole('admin'),
  adminController.getPractitioner.bind(adminController)
);

router.put(
  '/practitioners/:userId/membership',
  authenticate,
  requireRole('admin'),
  adminController.updateMembership.bind(adminController)
);

export default router;

