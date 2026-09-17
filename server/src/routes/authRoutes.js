import  express  from 'express';
import { registerUser, loginUser, logoutUser, logoutAllSessions, getMe, refreshAccessToken, checkEmail, checkUsername } from '../controller/userController.js';
import { validateRegister, validateLogin } from '../middleware/validationMiddleWare.js';
import protect from '../middleware/authMiddleWare.js';
import { authLimiter, refreshLimiter } from '../middleware/rateLimitMiddleware.js';
import { getUserPermissions } from '../controller/authController.js';

const router = express.Router();

// Rate-limited: these three are the brute-force / token-guessing targets
router.post('/register', authLimiter, validateRegister, registerUser);
router.post('/login', authLimiter, validateLogin, loginUser);
router.post('/refresh', refreshLimiter, refreshAccessToken);

router.post('/logout', logoutUser);
// Logout everywhere — requires a valid access token, revokes all refresh tokens
router.post('/logout-all', protect, logoutAllSessions);
router.get('/me', protect, getMe);
router.get('/check-username/:username', checkUsername);
router.get('/check-email/:email', checkEmail);
router.get('/permissions', protect, getUserPermissions);

export default router;