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

// Get full practitioner details (including documents, next of kin, clinical executor)
router.get(
  '/practitioners/:userId/full',
  authenticate,
  requireRole('admin'),
  adminController.getFullPractitioner.bind(adminController)
);

// Get practitioner credits and voucher summary (admin)
router.get(
  '/practitioners/:userId/credits',
  authenticate,
  requireRole('admin'),
  adminController.getPractitionerCredits.bind(adminController)
);

// Allocate free booking hours (voucher) to practitioner
router.post(
  '/practitioners/:userId/vouchers',
  authenticate,
  requireRole('admin'),
  adminController.allocateVoucher.bind(adminController)
);

// Update practitioner profile
router.put(
  '/practitioners/:userId',
  authenticate,
  requireRole('admin'),
  adminController.updatePractitioner.bind(adminController)
);

// Update practitioner membership
router.put(
  '/practitioners/:userId/membership',
  authenticate,
  requireRole('admin'),
  adminController.updateMembership.bind(adminController)
);

// Update practitioner next of kin
router.put(
  '/practitioners/:userId/next-of-kin',
  authenticate,
  requireRole('admin'),
  adminController.updateNextOfKin.bind(adminController)
);

// Update practitioner clinical executor
router.put(
  '/practitioners/:userId/clinical-executor',
  authenticate,
  requireRole('admin'),
  adminController.updateClinicalExecutor.bind(adminController)
);

// Delete practitioner
router.delete(
  '/practitioners/:userId',
  authenticate,
  requireRole('admin'),
  adminController.deletePractitioner.bind(adminController)
);

// Update document expiry date
router.put(
  '/practitioners/:userId/documents/:documentId/expiry',
  authenticate,
  requireRole('admin'),
  adminController.updateDocumentExpiry.bind(adminController)
);

export default router;
