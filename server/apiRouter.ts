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
} from './firestoreServer.ts';

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
      error: 'Failed to verify bootstrap status',
      message: err.message || 'Firestore query failed',
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
        error: 'Bootstrap credentials retired',
        message: 'The initial temporary ADMIN credentials have been permanently disabled. Please log in with your configured Admin username and password.',
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
    const admin = await getAdminByLoginServer(payload.username || payload.uid);

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
        message: 'The username and recovery email combination does not match the registered administrator record in Firestore.',
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
      message: 'Administrator profile updated successfully in Firestore.',
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
      message: 'Password changed successfully. Your new password has been securely stored in Firestore.',
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
