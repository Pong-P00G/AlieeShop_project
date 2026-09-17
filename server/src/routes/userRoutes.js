import express from 'express';
import * as userController from '../controller/userController.js';
import protect, { isAdmin } from '../middleware/authMiddleWare.js';
import { validateUpdate } from '../middleware/validationMiddleWare.js';

const router = express.Router();


// ── Self-service (any authenticated user, always scoped to req.user.id) ───────
// NOTE: /profile must be declared BEFORE /:id or it would be swallowed by it.
router.put('/profile', protect, validateUpdate, userController.updateProfile);

// ── Admin only ───────────────────────────────────────────────────────────────
router.get('/', protect, isAdmin, userController.getAllUsers);
router.post('/', protect, isAdmin, userController.createUsers);
router.get('/:id', protect, isAdmin, userController.getUserById);
router.put('/:id', protect, isAdmin, validateUpdate, userController.updateUser);
router.delete('/:id', protect, isAdmin, userController.deleteUser);

export default router;