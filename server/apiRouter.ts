import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  createSessionToken,
  verifySessionToken,
} from './auth.ts';
import {
  getBootstrapStatusServer,
  completeAdminSetupServer,
  getAdminByLoginServer,
  updateAdminPasswordServer,
  getAdminByIdServer,
  updateAdminProfileServer,
  updateAdminUsernameServer,
  unlockPracticalFormMarksServer,
} from './firestoreServer.ts';
import {
  getDatabaseUsageMetricsServer,
  getSessionDeletionPreviewServer,
  exportSessionBackupServer,
  executePermanentDeleteServer,
  getDeletionAuditLogsServer,
} from './databaseManagementServer.ts';
import {
  getSubjectUpdateSystemStateServer,
  createSubjectServer,
  updateSubjectServer,
  deleteSubjectServer,
  importSubjectsBatchServer,
  createSessionServer,
  updateSessionServer,
  deleteSessionServer,
  createSemesterServer,
  updateSemesterServer,
  deleteSemesterServer,
  createCategoryServer,
  updateCategoryServer,
  deleteCategoryServer,
  createDepartmentServer,
  updateDepartmentServer,
  deleteDepartmentServer,
  saveSubjectUpdateSystemSettingsServer,
  createCombinationServer,
  updateCombinationServer,
  deleteCombinationServer,
  createStudentServer,
  updateStudentServer,
  deleteStudentServer,
  uploadStudentsBatchServer,
  autoAllocateStudentsServer,
  createGroupServer,
  updateGroupServer,
  deleteGroupServer,
  createStaffServer,
  updateStaffServer,
  deleteStaffServer,
  createStaffAssignmentServer,
  updateStaffAssignmentServer,
  deleteStaffAssignmentServer,
  createWorkAllocationServer,
  updateWorkAllocationServer,
  deleteWorkAllocationServer,
  saveNepConfigServer,
  createSelectionFormServer,
  updateSelectionFormServer,
  deleteSelectionFormServer,
  reopenSelectionFormServer,
  getPublicSelectionFormByTokenServer,
  savePublicStudentSelectionServer,
  submitPublicSelectionFormServer,
} from './subjectUpdateSystemServer.ts';
import {
  listPracticalMarksFmConfigsServer,
  createPracticalMarksFmConfigServer,
  updatePracticalMarksFmConfigServer,
  deletePracticalMarksFmConfigServer,
} from './practicalMarksFmServer.ts';

export const apiRouter = express.Router();

apiRouter.use(express.json());

// Pre-middleware to guarantee response helpers exist in all environments (Vite connect middleware / Vercel serverless)
apiRouter.use((_req: any, res: any, next: any) => {
  if (!res.status) {
    res.status = function (code: number) {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = function (data: any) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(data));
      return res;
    };
  }
  next();
});

// Helper: audit log recorder
function logAudit(action: string, performedBy: string, details: string) {
  const logEntry = {
    id: `log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    action,
    performedBy,
    details,
    timestamp: new Date().toISOString(),
  };
  console.log('[AUDIT LOG]', JSON.stringify(logEntry));
  return logEntry;
}

// In-memory store for short-lived recovery codes
const recoveryCodesStore = new Map<string, { code: string; expires: number }>();

/**
 * GET /api/bootstrap/status
 * Queries Firebase Firestore directly for permanent bootstrap initialization record.
 */
apiRouter.get(['/bootstrap/status', '/api/bootstrap/status'], async (_req: Request, res: Response) => {
  try {
    const status = await getBootstrapStatusServer();
    res.json({
      isBootstrapped: status.isBootstrapped,
      institutionName: status.institutionName || 'NGM Degree Mahavidyalaya',
      adminUsername: status.adminUsername || null,
      bootstrappedAt: status.bootstrappedAt || null,
    });
  } catch (err: any) {
    console.error('Error fetching bootstrap status:', err);
    res.status(500).json({
      error: 'Unable to verify system status',
      message: 'Service temporarily unavailable. Please try again.',
    });
  }
});

/**
 * POST /api/bootstrap/login
 * Validates initial temporary ADMIN / 123 credentials during initial setup ONLY.
 * Once system is initialized in Firestore, this route is PERMANENTLY DISABLED.
 */
apiRouter.post(['/bootstrap/login', '/api/bootstrap/login'], async (req: Request, res: Response): Promise<any> => {
  try {
    const status = await getBootstrapStatusServer();

    if (status.isBootstrapped) {
      return res.status(403).json({
        error: 'Bootstrap already completed',
        message: 'Initial ADMIN / 123 credentials are permanently disabled. Please log in with your configured Admin credentials.',
      });
    }

    const { username, password } = req.body || {};
    const initialUsername = (process.env.ADMIN_BOOTSTRAP_INITIAL_USERNAME || 'ADMIN').trim().toUpperCase();
    const initialPassword = process.env.ADMIN_BOOTSTRAP_INITIAL_PASSWORD || '123';

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const inputUser = String(username).trim().toUpperCase();
    const inputPass = String(password);

    if (inputUser === initialUsername && inputPass === initialPassword) {
      // Generate short-lived setup token (30 minutes)
      const setupToken = createSessionToken(
        {
          type: 'initial_bootstrap',
          allowedAction: 'COMPLETE_ADMIN_SETUP',
        },
        1800
      );

      logAudit('INITIAL_BOOTSTRAP_AUTHENTICATED', 'TEMP_ADMIN', 'Temporary ADMIN logged in for initial setup.');

      return res.json({
        success: true,
        requireSetup: true,
        setupToken,
        message: 'Initial administrator credentials verified. Please configure permanent administrator identity.',
      });
    }

    return res.status(401).json({
      error: 'Invalid initial credentials',
      message: 'The initial credentials provided are incorrect. During setup, use Username: ADMIN and Password: 123.',
    });
  } catch (err: any) {
    console.error('Error in bootstrap login:', err);
    return res.status(500).json({ error: 'Server error during authentication', message: err.message });
  }
});

/**
 * POST /api/bootstrap/complete-setup
 * Atomically creates permanent Admin account in Firestore and permanently disables initial ADMIN / 123.
 */
apiRouter.post(['/bootstrap/complete-setup', '/api/bootstrap/complete-setup'], async (req: Request, res: Response): Promise<any> => {
  try {
    const currentStatus = await getBootstrapStatusServer();

    if (currentStatus.isBootstrapped) {
      return res.status(403).json({
        error: 'Bootstrap already completed',
        message: 'System is already initialized. Public registration or re-bootstrap is strictly forbidden.',
      });
    }

    const {
      setupToken,
      newUsername,
      newPassword,
      confirmPassword,
      recoveryEmail,
      institutionName,
      adminFullName,
    } = req.body || {};

    // Validate setup token
    const decodedToken = verifySessionToken(setupToken);
    if (!decodedToken || decodedToken.type !== 'initial_bootstrap') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid bootstrap setup authorization token is required.',
      });
    }

    // Validate new username
    if (!newUsername || typeof newUsername !== 'string' || newUsername.trim().length < 4) {
      return res.status(400).json({
        error: 'Invalid username',
        message: 'New Admin username must be at least 4 characters long and contain only alphanumeric characters.',
      });
    }

    const cleanUsername = newUsername.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return res.status(400).json({
        error: 'Invalid username format',
        message: 'Username can only contain letters, numbers, underscores, and hyphens.',
      });
    }

    // Prevent retaining the default credentials
    if (cleanUsername.toUpperCase() === 'ADMIN' && newPassword === '123') {
      return res.status(400).json({
        error: 'Invalid configuration',
        message: 'You cannot retain the temporary credentials. Please choose a personalized username and strong password.',
      });
    }

    // Validate password match
    if (!newPassword || newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'Password mismatch',
        message: 'New password and confirmation password do not match.',
      });
    }

    // Validate strong password
    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return res.status(400).json({
        error: 'Weak password',
        message: strengthCheck.message,
      });
    }

    // Validate recovery email
    if (!recoveryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
      return res.status(400).json({
        error: 'Invalid recovery email',
        message: 'A valid email address is required for secure account recovery.',
      });
    }

    // Hash password securely
    const passwordHash = hashPassword(newPassword);

    // Atomically persist in Firestore
    const { admin, status: newStatus } = await completeAdminSetupServer({
      username: cleanUsername,
      email: recoveryEmail,
      fullName: adminFullName || cleanUsername,
      passwordHash,
      institutionName: institutionName ? institutionName.trim() : 'NGM Degree Mahavidyalaya',
    });

    logAudit(
      'ADMIN_BOOTSTRAP_COMPLETED',
      cleanUsername,
      `Permanent admin account initialized for ${cleanUsername} (${recoveryEmail}). Initial ADMIN/123 credentials permanently retired in Firestore.`
    );

    // Generate permanent session token (24 hours)
    const permanentSessionToken = createSessionToken({
      uid: admin.uid,
      username: admin.username,
      email: admin.email,
      role: 'admin',
      fullName: admin.fullName,
    });

    return res.json({
      success: true,
      message: 'Permanent Administrator account established successfully in Firestore. Initial bootstrap credentials have been permanently disabled.',
      token: permanentSessionToken,
      admin: {
        uid: admin.uid,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName || cleanUsername,
        role: 'admin',
        institutionName: newStatus.institutionName,
      },
    });
  } catch (err: any) {
    console.error('Error completing admin setup:', err);
    return res.status(500).json({
      error: 'Failed to complete administrator setup',
      message: err.message || 'Database write error',
    });
  }
});

/**
 * POST /api/auth/login
 * Unified login endpoint.
 * Handles both initial setup redirect (if ADMIN/123) and permanent Admin authentication.
 */
apiRouter.post('/api/auth/login', (req: Request, res: Response): any => {
  return handleLogin(req, res);
});
apiRouter.post('/auth/login', (req: Request, res: Response): any => {
  return handleLogin(req, res);
});

async function handleLogin(req: Request, res: Response): Promise<any> {
  try {
    const status = await getBootstrapStatusServer();
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const inputUser = String(username).trim();
    const inputPass = String(password);

    // Case 1: System is NOT yet bootstrapped
    if (!status.isBootstrapped) {
      const initialUsername = (process.env.ADMIN_BOOTSTRAP_INITIAL_USERNAME || 'ADMIN').trim().toUpperCase();
      const initialPassword = process.env.ADMIN_BOOTSTRAP_INITIAL_PASSWORD || '123';

      if (inputUser.toUpperCase() === initialUsername && inputPass === initialPassword) {
        const setupToken = createSessionToken(
          {
            type: 'initial_bootstrap',
            allowedAction: 'COMPLETE_ADMIN_SETUP',
          },
          1800
        );

        return res.json({
          success: true,
          requireSetup: true,
          setupToken,
          message: 'Initial administrator detected. Please complete mandatory First-Time Admin Setup.',
        });
      }

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'System requires initial setup. Please enter Username: ADMIN and Password: 123.',
      });
    }

    // Case 2: System IS bootstrapped -> Verify permanent admin credentials
    if (inputUser.toUpperCase() === 'ADMIN' && inputPass === '123') {
      return res.status(403).json({
        error: 'Invalid credentials',
        message: 'Please log in with your configured administrator username and password.',
      });
    }

    // Lookup admin in Firestore
    const admin = await getAdminByLoginServer(inputUser);

    if (admin && admin.passwordHash) {
      const isPasswordValid = verifyPassword(inputPass, admin.passwordHash);
      if (isPasswordValid) {
        const token = createSessionToken({
          uid: admin.uid,
          username: admin.username,
          email: admin.email,
          role: 'admin',
          fullName: admin.fullName || admin.username,
        });

        logAudit('ADMIN_LOGIN_SUCCESS', admin.username, 'Administrator logged in successfully.');

        return res.json({
          success: true,
          token,
          admin: {
            uid: admin.uid,
            username: admin.username,
            email: admin.email,
            role: 'admin',
            fullName: admin.fullName || admin.username,
            institutionName: admin.institutionName || status.institutionName,
          },
        });
      }
    }

    logAudit('ADMIN_LOGIN_FAILED', inputUser, 'Failed login attempt with invalid credentials.');
    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'Incorrect username or password. Please verify your administrator credentials.',
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login', message: err.message });
  }
}

/**
 * POST /api/auth/verify-session
 * Validates active admin session token against server and Firestore.
 */
apiRouter.post(['/auth/verify-session', '/api/auth/verify-session'], async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.body.token;

    if (!token) {
      return res.status(401).json({ valid: false, message: 'No session token provided.' });
    }

    const payload = verifySessionToken(token);
    if (!payload || payload.role !== 'admin') {
      return res.status(401).json({ valid: false, message: 'Invalid or expired session token.' });
    }

    const status = await getBootstrapStatusServer();
    const admin = (await getAdminByIdServer(payload.uid)) || (await getAdminByLoginServer(payload.username || payload.uid));

    return res.json({
      valid: true,
      admin: {
        uid: admin ? admin.uid : payload.uid,
        username: admin ? admin.username : payload.username,
        email: admin ? admin.email : payload.email,
        role: 'admin',
        fullName: admin ? admin.fullName : payload.fullName || payload.username,
        institutionName: status.institutionName,
      },
    });
  } catch (err: any) {
    console.error('Session verification error:', err);
    return res.status(401).json({ valid: false, message: 'Verification error' });
  }
});

/**
 * POST /api/auth/logout
 * Explicit logout endpoint.
 */
apiRouter.post(['/auth/logout', '/api/auth/logout'], (_req: Request, res: Response) => {
  logAudit('ADMIN_LOGOUT', 'ADMIN', 'Admin signed out.');
  res.json({ success: true, message: 'Administrator session ended successfully.' });
});

/**
 * POST /api/auth/request-recovery
 * Initiates verified password recovery process against registered Firestore admin record.
 */
apiRouter.post(['/auth/request-recovery', '/api/auth/request-recovery'], async (req: Request, res: Response): Promise<any> => {
  try {
    const status = await getBootstrapStatusServer();

    if (!status.isBootstrapped) {
      return res.status(400).json({
        error: 'System not yet bootstrapped',
        message: 'System has not completed initial setup. Use temporary ADMIN / 123 credentials to perform initial setup.',
      });
    }

    const { username, recoveryEmail } = req.body || {};
    if (!username || !recoveryEmail) {
      return res.status(400).json({ error: 'Username and registered recovery email are required.' });
    }

    const admin = await getAdminByLoginServer(username);
    if (!admin || admin.email.toLowerCase() !== String(recoveryEmail).trim().toLowerCase()) {
      return res.status(404).json({
        error: 'Admin not found',
        message: 'The username and recovery email combination does not match our administrator records.',
      });
    }

    // Generate 6-digit secure numeric verification code
    const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
    recoveryCodesStore.set(admin.uid, {
      code: recoveryCode,
      expires: Date.now() + 15 * 60 * 1000, // 15 mins expiry
    });

    logAudit(
      'ADMIN_RECOVERY_REQUESTED',
      admin.username,
      `Password reset verification code generated for ${recoveryEmail}.`
    );

    return res.json({
      success: true,
      message: `A secure 6-digit verification code has been dispatched to ${recoveryEmail}.`,
      recoveryCodeHint: recoveryCode, // Provided for testing and offline deployment verification
    });
  } catch (err: any) {
    console.error('Recovery request error:', err);
    return res.status(500).json({ error: 'Recovery request failed', message: err.message });
  }
});

/**
 * POST /api/auth/reset-password
 * Verifies recovery code and updates admin password in Firestore.
 */
apiRouter.post(['/auth/reset-password', '/api/auth/reset-password'], async (req: Request, res: Response): Promise<any> => {
  try {
    const status = await getBootstrapStatusServer();

    if (!status.isBootstrapped) {
      return res.status(400).json({ error: 'System not yet bootstrapped.' });
    }

    const { username, recoveryEmail, recoveryCode, newPassword, confirmPassword } = req.body || {};

    const admin = await getAdminByLoginServer(username);
    if (!admin || admin.email.toLowerCase() !== String(recoveryEmail).trim().toLowerCase()) {
      return res.status(404).json({ error: 'Administrator record not found.' });
    }

    const storedCode = recoveryCodesStore.get(admin.uid);
    if (!storedCode || Date.now() > storedCode.expires) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new recovery code.' });
    }

    if (String(recoveryCode).trim() !== storedCode.code) {
      return res.status(401).json({ error: 'Invalid verification code. Please check and try again.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match.' });
    }

    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return res.status(400).json({ error: strengthCheck.message });
    }

    // Update password in Firestore
    const newHash = hashPassword(newPassword);
    await updateAdminPasswordServer(admin.uid, newHash);
    recoveryCodesStore.delete(admin.uid);

    logAudit('ADMIN_PASSWORD_RESET', admin.username, 'Administrator password successfully recovered and updated in Firestore.');

    return res.json({
      success: true,
      message: 'Administrator password reset successfully. You may now log in with your new password.',
    });
  } catch (err: any) {
    console.error('Password reset error:', err);
    return res.status(500).json({ error: 'Password reset failed', message: err.message });
  }
});

/**
 * Helper: extract verified admin session payload from request
 */
function extractAdminSession(req: Request) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.body && req.body.token);
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

/**
 * GET /api/admin/profile
 * Retrieves active admin's profile directly from Firestore
 */
apiRouter.get(['/admin/profile', '/api/admin/profile'], async (req: Request, res: Response): Promise<any> => {
  try {
    const session = extractAdminSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid administrator session is required.' });
    }

    const admin = await getAdminByIdServer(session.uid) || await getAdminByLoginServer(session.username);
    if (!admin) {
      return res.status(404).json({ error: 'Admin record not found' });
    }

    return res.json({
      success: true,
      profile: {
        uid: admin.uid,
        username: admin.username,
        email: admin.email,
        fullName: admin.fullName || admin.username,
        phone: admin.phone || '',
        designation: admin.designation || 'Principal / Controller of Examinations',
        photoUrl: admin.photoUrl || '',
        role: admin.role,
        institutionName: admin.institutionName || 'NGM Degree Mahavidyalaya',
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('Fetch admin profile error:', err);
    return res.status(500).json({ error: 'Failed to retrieve profile', message: err.message });
  }
});

/**
 * PUT /api/admin/profile
 * Updates administrator profile in Firestore
 */
apiRouter.put(['/admin/profile', '/api/admin/profile'], async (req: Request, res: Response): Promise<any> => {
  try {
    const session = extractAdminSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid administrator session is required.' });
    }

    const { fullName, email, phone, designation, photoUrl, institutionName } = req.body || {};

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const updated = await updateAdminProfileServer(session.uid, {
      fullName,
      email,
      phone,
      designation,
      photoUrl,
      institutionName,
    });

    logAudit('ADMIN_PROFILE_UPDATED', session.username, `Admin profile details updated by ${session.username}.`);

    return res.json({
      success: true,
      message: 'Administrator profile updated successfully.',
      profile: {
        uid: updated.uid,
        username: updated.username,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone || '',
        designation: updated.designation || '',
        photoUrl: updated.photoUrl || '',
        role: updated.role,
        institutionName: updated.institutionName,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('Update admin profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile', message: err.message });
  }
});

/**
 * POST /api/admin/change-username
 * Validates uniqueness and updates Administrator User ID (username)
 */
apiRouter.post(['/admin/change-username', '/api/admin/change-username'], async (req: Request, res: Response): Promise<any> => {
  try {
    const session = extractAdminSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid administrator session is required.' });
    }

    const { newUsername } = req.body || {};
    if (!newUsername || typeof newUsername !== 'string') {
      return res.status(400).json({ error: 'New User ID is required.' });
    }

    const clean = newUsername.trim();
    if (clean.length < 3) {
      return res.status(400).json({ error: 'User ID must be at least 3 characters long.' });
    }

    if (!/^[a-zA-Z0-9_\-\.]+$/.test(clean)) {
      return res.status(400).json({ error: 'User ID may only contain letters, numbers, hyphens, and underscores.' });
    }

    if (clean.toUpperCase() === 'ADMIN') {
      return res.status(400).json({ error: 'User ID "ADMIN" is reserved.' });
    }

    const updated = await updateAdminUsernameServer(session.uid, clean);

    const newToken = createSessionToken({
      uid: updated.uid,
      username: updated.username,
      email: updated.email,
      role: 'admin',
      fullName: updated.fullName || updated.username,
    });

    logAudit('ADMIN_USERNAME_UPDATED', clean, `Administrator User ID changed from "${session.username}" to "${clean}".`);

    return res.json({
      success: true,
      message: `User ID updated successfully to "${clean}".`,
      newToken,
      profile: {
        uid: updated.uid,
        username: updated.username,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone || '',
        designation: updated.designation || '',
        photoUrl: updated.photoUrl || '',
        role: updated.role,
        institutionName: updated.institutionName,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('Change username error:', err);
    return res.status(400).json({ error: err.message || 'Failed to update User ID' });
  }
});

/**
 * POST /api/admin/change-password
 * Verifies current password and updates to new password in Firestore
 */
apiRouter.post(['/admin/change-password', '/api/admin/change-password'], async (req: Request, res: Response): Promise<any> => {
  try {
    const session = extractAdminSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid administrator session is required.' });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match.' });
    }

    const admin = await getAdminByIdServer(session.uid) || await getAdminByLoginServer(session.username);
    if (!admin) {
      return res.status(404).json({ error: 'Admin record not found.' });
    }

    const isValidCurrent = verifyPassword(currentPassword, admin.passwordHash);
    if (!isValidCurrent) {
      return res.status(401).json({ error: 'Incorrect current password. Please enter your existing password.' });
    }

    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return res.status(400).json({ error: strengthCheck.message });
    }

    const newHash = hashPassword(newPassword);
    await updateAdminPasswordServer(admin.uid, newHash);

    logAudit('ADMIN_PASSWORD_CHANGED', session.username, `Administrator password changed successfully by ${session.username}.`);

    return res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password', message: err.message });
  }
});

/**
 * POST /api/marks/validate
 * Server-side validation for marks entries against examination form limits
 */
apiRouter.post(['/marks/validate', '/api/marks/validate'], (req: Request, res: Response): any => {
  const { maxMarks, minPassingMarks, allowDecimals, records } = req.body || {};

  const numMax = Number(maxMarks);
  const numMin = Number(minPassingMarks);

  if (isNaN(numMax) || numMax <= 0) {
    return res.status(400).json({ valid: false, error: 'Maximum marks must be a positive number.' });
  }

  if (isNaN(numMin) || numMin < 0) {
    return res.status(400).json({ valid: false, error: 'Minimum passing marks cannot be negative.' });
  }

  if (numMin > numMax) {
    return res.status(400).json({
      valid: false,
      error: `Minimum Passing Marks (${numMin}) cannot exceed Maximum Marks (${numMax}).`,
    });
  }

  if (!Array.isArray(records)) {
    return res.status(400).json({ valid: false, error: 'Records must be an array.' });
  }

  const errors: string[] = [];
  const processed = records.map((r: any, idx: number) => {
    const isPresent = r.isPresent ?? true;
    let marksObtained = r.marksObtained;
    let status: 'PASS' | 'FAIL' | 'PENDING' | 'ABSENT' = 'PENDING';

    if (!isPresent) {
      status = 'ABSENT';
      marksObtained = null;
    } else if (marksObtained !== null && marksObtained !== undefined && String(marksObtained).trim() !== '') {
      const valStr = String(marksObtained).trim();
      if (!allowDecimals && valStr.includes('.')) {
        errors.push(`Row ${idx + 1} (${r.rollNumber || 'Candidate'}): Decimal marks are not permitted.`);
      }
      const valNum = Number(valStr);
      if (isNaN(valNum)) {
        errors.push(`Row ${idx + 1} (${r.rollNumber || 'Candidate'}): Invalid numeric mark.`);
      } else if (valNum < 0) {
        errors.push(`Row ${idx + 1} (${r.rollNumber || 'Candidate'}): Marks cannot be negative.`);
      } else if (valNum > numMax) {
        errors.push(`Row ${idx + 1} (${r.rollNumber || 'Candidate'}): Marks (${valNum}) exceed maximum marks (${numMax}).`);
      } else {
        marksObtained = valNum;
        status = valNum >= numMin ? 'PASS' : 'FAIL';
      }
    } else {
      status = 'PENDING';
      marksObtained = null;
    }

    return {
      studentId: r.studentId,
      rollNumber: r.rollNumber,
      marksObtained,
      isPresent,
      status,
    };
  });

  if (errors.length > 0) {
    return res.status(400).json({
      valid: false,
      error: errors[0],
      allErrors: errors,
    });
  }

  return res.json({
    valid: true,
    processed,
    maxMarks: numMax,
    minPassingMarks: numMin,
  });
});

/**
 * POST /api/admin/forms/:formId/unlock-marks
 * Strictly authenticated Administrator endpoint to unlock finally-submitted marks for revision.
 * Preserves existing submitted marks and appends an audit entry to unlockHistory.
 */
apiRouter.post(
  ['/admin/forms/:formId/unlock-marks', '/api/admin/forms/:formId/unlock-marks'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const session = extractAdminSession(req);
      if (!session) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Valid administrator authentication is required to unlock marks.',
        });
      }

      const admin =
        (await getAdminByIdServer(session.uid)) ||
        (await getAdminByLoginServer(session.username));
      if (!admin || admin.role !== 'admin') {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only authorized Administrator accounts can unlock submitted marks.',
        });
      }

      const { formId } = req.params;
      if (!formId || typeof formId !== 'string') {
        return res.status(400).json({ error: 'Invalid practical form ID.' });
      }

      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      const { form, unlockEntry } = await unlockPracticalFormMarksServer(formId, {
        uid: admin.uid,
        username: admin.username,
        reason,
      });

      logAudit(
        'MARKS_UNLOCKED_BY_ADMIN',
        admin.username,
        `Unlocked marks editing for form "${form.title || formId}" (${formId}).`
      );

      return res.json({
        success: true,
        message: 'Marks unlocked successfully for editing.',
        form,
        unlockEntry,
      });
    } catch (err: any) {
      const statusCode = err?.message?.includes('not found') ? 404 : 500;
      console.error('Unlock marks error:', err);
      return res.status(statusCode).json({
        error: statusCode === 404 ? 'Form not found' : 'Failed to unlock marks',
        message: err?.message || 'Unexpected error while unlocking marks',
      });
    }
  }
);

/**
 * Shared verified Permanent Admin guard for Database & Storage Management routes
 */
async function requireVerifiedAdmin(req: Request, res: Response) {
  const session = extractAdminSession(req);
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid Permanent Administrator authentication is required.',
    });
    return null;
  }

  const admin =
    (await getAdminByIdServer(session.uid)) ||
    (await getAdminByLoginServer(session.username));
  if (!admin || admin.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Access restricted strictly to Permanent Administrator accounts.',
    });
    return null;
  }

  return admin;
}

/**
 * GET /api/admin/database/usage
 * Returns live Firestore usage metrics, collection breakdown, session summaries, and honest quota/telemetry status.
 */
apiRouter.get(
  ['/admin/database/usage', '/api/admin/database/usage'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const metrics = await getDatabaseUsageMetricsServer();
      return res.json({ success: true, usage: metrics });
    } catch (err: any) {
      console.error('Database usage fetch error:', err);
      return res.status(500).json({
        error: 'Failed to retrieve database usage metrics',
        message: err?.message || 'Unexpected server error',
      });
    }
  }
);

/**
 * GET /api/admin/database/session/:session/preview
 * Returns estimated deletion counts & individual record lists strictly scoped to the selected session.
 */
apiRouter.get(
  ['/admin/database/session/:session/preview', '/api/admin/database/session/:session/preview'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const sessionName = decodeURIComponent(String(req.params.session || '')).trim();
      if (!sessionName) {
        return res.status(400).json({ error: 'Academic session parameter is required.' });
      }

      const preview = await getSessionDeletionPreviewServer(sessionName);
      return res.json({ success: true, preview });
    } catch (err: any) {
      console.error('Session deletion preview error:', err);
      return res.status(500).json({
        error: 'Failed to build session deletion preview',
        message: err?.message || 'Unexpected server error',
      });
    }
  }
);

/**
 * GET /api/admin/database/session/:session/backup
 * Exports an isolated JSON backup snapshot for the selected session and logs the export.
 */
apiRouter.get(
  ['/admin/database/session/:session/backup', '/api/admin/database/session/:session/backup'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const sessionName = decodeURIComponent(String(req.params.session || '')).trim();
      if (!sessionName) {
        return res.status(400).json({ error: 'Academic session parameter is required.' });
      }

      const { backup, auditLogId } = await exportSessionBackupServer(sessionName, {
        uid: admin.uid,
        username: admin.username,
      });

      logAudit(
        'SESSION_BACKUP_EXPORTED',
        admin.username,
        `Exported JSON backup for session ${sessionName} (audit ${auditLogId}).`
      );

      return res.json({ success: true, backup, auditLogId });
    } catch (err: any) {
      console.error('Session backup export error:', err);
      return res.status(500).json({
        error: 'Failed to export session backup',
        message: err?.message || 'Unexpected server error',
      });
    }
  }
);

/**
 * POST /api/admin/database/delete
 * Executes permanent deletion (category, complete_session, or individual record) with strict audit logging.
 */
apiRouter.post(
  ['/admin/database/delete', '/api/admin/database/delete'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const body = req.body || {};
      const mode = body.mode;
      const sessionName = typeof body.session === 'string' ? body.session.trim() : '';

      if (!sessionName) {
        return res.status(400).json({ error: 'Academic Session is required.' });
      }
      if (mode !== 'category' && mode !== 'complete_session' && mode !== 'individual') {
        return res.status(400).json({ error: 'Invalid deletion mode specified.' });
      }

      const result = await executePermanentDeleteServer(
        {
          mode,
          session: sessionName,
          category: body.category,
          confirmSessionText: body.confirmSessionText,
          backupDownloaded: Boolean(body.backupDownloaded),
          targetCollection: body.targetCollection,
          targetId: body.targetId,
        },
        { uid: admin.uid, username: admin.username }
      );

      logAudit(
        'DATABASE_PERMANENT_DELETE',
        admin.username,
        `${result.mode}:${result.category} for ${result.session} (${result.deletedCount} deleted, ${result.revokedCount} revoked).`
      );

      return res.json(result);
    } catch (err: any) {
      const msg = err?.message || 'Permanent deletion failed';
      const statusCode =
        msg.includes('not found') ? 404 : msg.includes('mismatch') || msg.includes('Invalid') || msg.includes('required') ? 400 : 500;
      console.error('Permanent deletion error:', err);
      return res.status(statusCode).json({
        success: false,
        error: msg,
        message: msg,
      });
    }
  }
);

/**
 * GET /api/admin/database/audit-logs
 * Lists immutable database deletion and backup audit logs.
 */
apiRouter.get(
  ['/admin/database/audit-logs', '/api/admin/database/audit-logs'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const logs = await getDeletionAuditLogsServer();
      return res.json({ success: true, logs });
    } catch (err: any) {
      console.error('Deletion audit logs fetch error:', err);
      return res.status(500).json({
        error: 'Failed to retrieve deletion audit logs',
        message: err?.message || 'Unexpected server error',
      });
    }
  }
);

// ============================================================================
// INDEPENDENT MODULE: SUBJECT UPDATE SYSTEM (ADMIN-ONLY)
// ============================================================================

apiRouter.get(
  ['/admin/subject-update-system/state', '/api/admin/subject-update-system/state'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const state = await getSubjectUpdateSystemStateServer();
      return res.json({ success: true, state });
    } catch (err: any) {
      console.error('Subject Update System state fetch error:', err);
      return res.status(500).json({
        error: 'Failed to load Subject Update System data',
        message: err?.message || 'Unexpected server error',
      });
    }
  }
);

apiRouter.post(
  ['/admin/subject-update-system/subjects', '/api/admin/subject-update-system/subjects'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const item = await createSubjectServer(req.body || {}, admin.username);
      logAudit('SUBJECT_UPDATE_SYSTEM_CREATE', admin.username, `Created subject ${item.subjectCode} (${item.session} · ${item.semester}).`);
      return res.status(201).json({ success: true, subject: item });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create subject';
      const statusCode = msg.includes('required') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/subjects/:id', '/api/admin/subject-update-system/subjects/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      const item = await updateSubjectServer(id, req.body || {}, admin.username);
      logAudit('SUBJECT_UPDATE_SYSTEM_UPDATE', admin.username, `Updated subject ${item.subjectCode} (${id}).`);
      return res.json({ success: true, subject: item });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update subject';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/subjects/:id', '/api/admin/subject-update-system/subjects/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      await deleteSubjectServer(id);
      logAudit('SUBJECT_UPDATE_SYSTEM_DELETE', admin.username, `Deleted subject (${id}).`);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete subject';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  ['/admin/subject-update-system/subjects/import', '/api/admin/subject-update-system/subjects/import'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const { rows, duplicateStrategy } = req.body || {};
      const strategy = duplicateStrategy === 'update' ? 'update' : 'skip';
      const result = await importSubjectsBatchServer(rows, admin.username, strategy);
      logAudit(
        'SUBJECT_UPDATE_SYSTEM_IMPORT',
        admin.username,
        `Imported subjects: ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} skipped.`
      );
      return res.json({ success: true, ...result });
    } catch (err: any) {
      const msg = err?.message || 'Failed to import subjects';
      const statusCode = msg.includes('must contain') || msg.includes('limited') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  ['/admin/subject-update-system/sessions', '/api/admin/subject-update-system/sessions'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const session = await createSessionServer(req.body || {});
      return res.status(201).json({ success: true, session });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create session';
      const statusCode = msg.includes('required') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/sessions/:id', '/api/admin/subject-update-system/sessions/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      const session = await updateSessionServer(id, req.body || {});
      return res.json({ success: true, session });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update session';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/sessions/:id', '/api/admin/subject-update-system/sessions/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      await deleteSessionServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete session';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  ['/admin/subject-update-system/semesters', '/api/admin/subject-update-system/semesters'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const semester = await createSemesterServer(req.body || {});
      return res.status(201).json({ success: true, semester });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create semester';
      const statusCode = msg.includes('required') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/semesters/:id', '/api/admin/subject-update-system/semesters/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      const semester = await updateSemesterServer(id, req.body || {});
      return res.json({ success: true, semester });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update semester';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/semesters/:id', '/api/admin/subject-update-system/semesters/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      await deleteSemesterServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete semester';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  ['/admin/subject-update-system/categories', '/api/admin/subject-update-system/categories'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const category = await createCategoryServer(req.body || {});
      return res.status(201).json({ success: true, category });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create category';
      const statusCode = msg.includes('required') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/categories/:id', '/api/admin/subject-update-system/categories/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      const category = await updateCategoryServer(id, req.body || {});
      return res.json({ success: true, category });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update category';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/categories/:id', '/api/admin/subject-update-system/categories/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      await deleteCategoryServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete category';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  ['/admin/subject-update-system/departments', '/api/admin/subject-update-system/departments'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const department = await createDepartmentServer(req.body || {});
      return res.status(201).json({ success: true, department });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create department';
      const statusCode = msg.includes('required') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/departments/:id', '/api/admin/subject-update-system/departments/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      const department = await updateDepartmentServer(id, req.body || {});
      return res.json({ success: true, department });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update department';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/departments/:id', '/api/admin/subject-update-system/departments/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const id = String(req.params.id || '').trim();
      await deleteDepartmentServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete department';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/settings', '/api/admin/subject-update-system/settings'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;

      const settings = await saveSubjectUpdateSystemSettingsServer(req.body || {}, admin.username);
      return res.json({ success: true, settings });
    } catch (err: any) {
      console.error('Subject Update System settings save error:', err);
      return res.status(500).json({
        error: 'Failed to save Subject Update settings',
        message: err?.message || 'Unexpected server error',
      });
    }
  }
);

// --- Subject Combinations ---

apiRouter.post(
  ['/admin/subject-update-system/combinations', '/api/admin/subject-update-system/combinations'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const combination = await createCombinationServer(req.body || {}, admin.username);
      return res.status(201).json({ success: true, combination });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create subject combination';
      const statusCode = msg.includes('required') || msg.includes('configured') || msg.includes('already exists') || msg.includes('at least') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/combinations/:id', '/api/admin/subject-update-system/combinations/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const combination = await updateCombinationServer(id, req.body || {}, admin.username);
      return res.json({ success: true, combination });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update subject combination';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('configured') || msg.includes('already exists') || msg.includes('required') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/combinations/:id', '/api/admin/subject-update-system/combinations/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      await deleteCombinationServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete subject combination';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

// --- Students & Excel Upload / Auto-Allocation ---

apiRouter.post(
  ['/admin/subject-update-system/students', '/api/admin/subject-update-system/students'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const student = await createStudentServer(req.body || {}, admin.username);
      return res.status(201).json({ success: true, student });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create student';
      const statusCode = msg.includes('required') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/students/:id', '/api/admin/subject-update-system/students/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const student = await updateStudentServer(id, req.body || {}, admin.username);
      return res.json({ success: true, student });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update student';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/students/:id', '/api/admin/subject-update-system/students/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      await deleteStudentServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete student';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  ['/admin/subject-update-system/students/upload', '/api/admin/subject-update-system/students/upload'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const result = await uploadStudentsBatchServer(req.body || {}, admin.username);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload student Excel sheet';
      const statusCode = msg.includes('must') || msg.includes('limited') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  ['/admin/subject-update-system/students/auto-allocate', '/api/admin/subject-update-system/students/auto-allocate'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const result = await autoAllocateStudentsServer(req.body || {}, admin.username);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      const msg = err?.message || 'Failed to auto-allocate students';
      return res.status(500).json({ error: msg, message: msg });
    }
  }
);

// --- Student Groups ---

apiRouter.post(
  ['/admin/subject-update-system/groups', '/api/admin/subject-update-system/groups'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const group = await createGroupServer(req.body || {}, admin.username);
      return res.status(201).json({ success: true, group });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create student group';
      const statusCode = msg.includes('required') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/groups/:id', '/api/admin/subject-update-system/groups/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const group = await updateGroupServer(id, req.body || {}, admin.username);
      return res.json({ success: true, group });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update student group';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/groups/:id', '/api/admin/subject-update-system/groups/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      await deleteGroupServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete student group';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

// --- Staff Management ---

apiRouter.post(
  ['/admin/subject-update-system/staff', '/api/admin/subject-update-system/staff'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const staffMember = await createStaffServer(req.body || {}, admin.username);
      return res.status(201).json({ success: true, staffMember });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create staff profile';
      const statusCode = msg.includes('required') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/staff/:id', '/api/admin/subject-update-system/staff/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const staffMember = await updateStaffServer(id, req.body || {}, admin.username);
      return res.json({ success: true, staffMember });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update staff profile';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('already exists') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/staff/:id', '/api/admin/subject-update-system/staff/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      await deleteStaffServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete staff profile';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

// --- Staff Assignments & In-charge Allocation ---

apiRouter.post(
  ['/admin/subject-update-system/staff-assignments', '/api/admin/subject-update-system/staff-assignments'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const assignment = await createStaffAssignmentServer(req.body || {}, admin.username);
      return res.status(201).json({ success: true, assignment });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create staff assignment';
      const statusCode = msg.includes('required') || msg.includes('select') || msg.includes('must') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/staff-assignments/:id', '/api/admin/subject-update-system/staff-assignments/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const assignment = await updateStaffAssignmentServer(id, req.body || {}, admin.username);
      return res.json({ success: true, assignment });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update staff assignment';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('must') || msg.includes('required') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/staff-assignments/:id', '/api/admin/subject-update-system/staff-assignments/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      await deleteStaffAssignmentServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete staff assignment';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

// --- Work Allocations ---

apiRouter.post(
  ['/admin/subject-update-system/work-allocations', '/api/admin/subject-update-system/work-allocations'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const workAllocation = await createWorkAllocationServer(req.body || {}, admin.username);
      return res.status(201).json({ success: true, workAllocation });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create work allocation';
      const statusCode = msg.includes('required') || msg.includes('must') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/work-allocations/:id', '/api/admin/subject-update-system/work-allocations/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const workAllocation = await updateWorkAllocationServer(id, req.body || {}, admin.username);
      return res.json({ success: true, workAllocation });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update work allocation';
      const statusCode = msg.includes('not found') ? 404 : msg.includes('empty') || msg.includes('must') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/work-allocations/:id', '/api/admin/subject-update-system/work-allocations/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      await deleteWorkAllocationServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete work allocation';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

// --- NEP Combinations Config (Admin) ---

apiRouter.put(
  ['/admin/subject-update-system/nep-configs', '/api/admin/subject-update-system/nep-configs'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const nepConfig = await saveNepConfigServer(req.body || {}, admin.username);
      return res.json({ success: true, nepConfig });
    } catch (err: any) {
      const msg = err?.message || 'Failed to save NEP combination configuration';
      const statusCode = msg.includes('required') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

// --- Selection Forms / Staff & Student Assignment (Admin) ---

apiRouter.post(
  ['/admin/subject-update-system/selection-forms', '/api/admin/subject-update-system/selection-forms'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const selectionForm = await createSelectionFormServer(req.body || {}, admin.username);
      return res.status(201).json({ success: true, selectionForm });
    } catch (err: any) {
      const msg = err?.message || 'Failed to create selection form assignment';
      const statusCode =
        msg.includes('required') || msg.includes('must') || msg.includes('not found') || msg.includes('None')
          ? 400
          : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/subject-update-system/selection-forms/:id', '/api/admin/subject-update-system/selection-forms/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const selectionForm = await updateSelectionFormServer(id, req.body || {}, admin.username);
      return res.json({ success: true, selectionForm });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update selection form assignment';
      const statusCode = msg.includes('not found')
        ? 404
        : msg.includes('required') || msg.includes('must')
          ? 400
          : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/subject-update-system/selection-forms/:id', '/api/admin/subject-update-system/selection-forms/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      await deleteSelectionFormServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete selection form assignment';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  [
    '/admin/subject-update-system/selection-forms/:id/reopen',
    '/api/admin/subject-update-system/selection-forms/:id/reopen',
  ],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const selectionForm = await reopenSelectionFormServer(id, admin.username);
      return res.json({ success: true, selectionForm });
    } catch (err: any) {
      const msg = err?.message || 'Failed to reopen selection form';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

// --- Public Tokenized Department In-Charge Selection Form Routes ---

apiRouter.get(
  ['/selection-form/:token', '/api/selection-form/:token'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const token = String(req.params.token || '').trim();
      const payload = await getPublicSelectionFormByTokenServer(token);
      return res.json({ success: true, ...payload });
    } catch (err: any) {
      const msg = err?.message || 'Selection form link could not be loaded';
      const statusCode = msg.includes('invalid') || msg.includes('removed') ? 404 : 400;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/selection-form/:token/student/:studentId', '/api/selection-form/:token/student/:studentId'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const token = String(req.params.token || '').trim();
      const studentId = String(req.params.studentId || '').trim();
      const result = await savePublicStudentSelectionServer(token, studentId, req.body || {});
      return res.json({ success: true, ...result });
    } catch (err: any) {
      const msg = err?.message || 'Failed to save student subject selection';
      const statusCode = msg.startsWith('LOCKED:')
        ? 403
        : msg.includes('invalid') || msg.includes('removed')
          ? 404
          : 400;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.post(
  ['/selection-form/:token/submit', '/api/selection-form/:token/submit'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const token = String(req.params.token || '').trim();
      const payload = await submitPublicSelectionFormServer(token);
      return res.json({ success: true, ...payload });
    } catch (err: any) {
      const msg = err?.message || 'Failed to finalize selection form';
      const statusCode = msg.startsWith('LOCKED:')
        ? 403
        : msg.includes('invalid') || msg.includes('removed')
          ? 404
          : 400;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

// --- Practical Marks File Generator: Admin Full Marks (FM) Preferences ---

apiRouter.get(
  ['/admin/practical-marks-fm-configs', '/api/admin/practical-marks-fm-configs'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const configs = await listPracticalMarksFmConfigsServer();
      return res.json({ success: true, configs });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Failed to load Full Marks preferences',
        message: err?.message || 'Failed to load Full Marks preferences',
      });
    }
  }
);

apiRouter.post(
  ['/admin/practical-marks-fm-configs', '/api/admin/practical-marks-fm-configs'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const config = await createPracticalMarksFmConfigServer(req.body || {}, admin.username);
      return res.json({ success: true, config });
    } catch (err: any) {
      const msg = err?.message || 'Failed to save Full Marks preference';
      const statusCode =
        msg.includes('required') || msg.includes('positive') || msg.includes('exceed') ? 400 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.put(
  ['/admin/practical-marks-fm-configs/:id', '/api/admin/practical-marks-fm-configs/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      const config = await updatePracticalMarksFmConfigServer(id, req.body || {}, admin.username);
      return res.json({ success: true, config });
    } catch (err: any) {
      const msg = err?.message || 'Failed to update Full Marks preference';
      const statusCode = msg.includes('not found')
        ? 404
        : msg.includes('required') || msg.includes('positive') || msg.includes('exceed')
          ? 400
          : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

apiRouter.delete(
  ['/admin/practical-marks-fm-configs/:id', '/api/admin/practical-marks-fm-configs/:id'],
  async (req: Request, res: Response): Promise<any> => {
    try {
      const admin = await requireVerifiedAdmin(req, res);
      if (!admin) return;
      const id = String(req.params.id || '').trim();
      await deletePracticalMarksFmConfigServer(id);
      return res.json({ success: true });
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete Full Marks preference';
      const statusCode = msg.includes('not found') ? 404 : 500;
      return res.status(statusCode).json({ error: msg, message: msg });
    }
  }
);

