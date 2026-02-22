import { Router } from 'express';
import { registerPatient, registerDoctor, getMe, searchPatients } from '../controllers/auth.controller.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';
import { validate, schemas } from '../middleware/validate.middleware.js';

const router = Router();

// All auth routes require a valid Firebase token
router.use(authenticate);

/**
 * POST /api/auth/register/patient
 * Create a patient profile after Firebase sign-up
 */
router.post('/register/patient', validate(schemas.registerPatient), registerPatient);

/**
 * POST /api/auth/register/doctor
 * Create a doctor profile (pending verification)
 */
router.post('/register/doctor', validate(schemas.registerDoctor), registerDoctor);

/**
 * GET /api/auth/me
 * Get the authenticated user's full profile
 */
router.get('/me', getMe);

/**
 * GET /api/auth/patients/search?q=<name>
 * Doctor searches patients by display name/email.
 */
router.get('/patients/search', requireRole('doctor'), searchPatients);

export default router;
