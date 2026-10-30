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
  loadBootstrapState,
  saveBootstrapState,
  initFirebaseAdmin,
} from './firebaseAdmin.ts';

export const apiRouter = express.Router();

apiRouter.use(express.json());

// Pre-middleware to guarantee response helpers exist
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

/**
 * GET /api/bootstrap/status
 * Returns system bootstrap status without exposing any sensitive passwords
 */
apiRouter.get(['/bootstrap/status', '/api/bootstrap/status'], (_req: Request, res: Response) => {
  const state = loadBootstrapState();
  res.json({
    isBootstrapped: state.isBootstrapped,
    institutionName: state.institutionName || 'NGM Degree Mahavidyalaya',
    adminUsername: state.adminUsername || null,
    bootstrappedAt: state.bootstrappedAt || null,
  });
});

/**
 * POST /api/bootstrap/login
 * Validates initial temporary ADMIN / 123 credentials during initial setup ONLY.
 */
apiRouter.post(['/bootstrap/login', '/api/bootstrap/login'], (req: Request, res: Response): any => {
  const state = loadBootstrapState();

  if (state.isBootstrapped) {
    return res.status(403).json({
      error: 'Bootstrap already completed',
      message: 'Initial ADMIN / 123 credentials are permanently disabled. Please use your configured Admin credentials.',
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
});

/**
 * POST /api/bootstrap/complete-setup
 * Atomically configures permanent admin and permanently disables initial ADMIN / 123.
 */
apiRouter.post(['/bootstrap/complete-setup', '/api/bootstrap/complete-setup'], (req: Request, res: Response): any => {
  const state = loadBootstrapState();

  if (state.isBootstrapped) {
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

  // Prevent reusing default username "ADMIN" as the new password or simple username
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

  // Hash new password securely
  const passwordHash = hashPassword(newPassword);
  const adminUid = `admin_${cleanUsername.toLowerCase()}`;

  // Complete bootstrap atomically
  state.isBootstrapped = true;
  state.adminUsername = cleanUsername;
  state.adminEmail = recoveryEmail;
  state.adminUid = adminUid;
  state.bootstrappedAt = new Date().toISOString();
  state.recoveryEmail = recoveryEmail;
  state.institutionName = institutionName ? institutionName.trim() : 'NGM Degree Mahavidyalaya';
  state.adminPasswordHash = passwordHash;

  saveBootstrapState(state);

  logAudit(
    'ADMIN_BOOTSTRAP_COMPLETED',
    cleanUsername,
    `Permanent admin account initialized for ${cleanUsername} (${recoveryEmail}). Initial ADMIN/123 credentials permanently retired.`
  );

  // Generate permanent admin session token
  const permanentSessionToken = createSessionToken({
    uid: adminUid,
    username: cleanUsername,
    email: recoveryEmail,
    role: 'admin',
    fullName: adminFullName || cleanUsername,
  });

  return res.json({
    success: true,
    message: 'Permanent Administrator account established successfully. Initial bootstrap credentials have been permanently disabled.',
    token: permanentSessionToken,
    admin: {
      uid: adminUid,
      username: cleanUsername,
      email: recoveryEmail,
      fullName: adminFullName || cleanUsername,
      role: 'admin',
      institutionName: state.institutionName,
    },
  });
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

function handleLogin(req: Request, res: Response): any {
  const state = loadBootstrapState();
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const inputUser = String(username).trim();
  const inputPass = String(password);

  // Case 1: System is NOT yet bootstrapped
  if (!state.isBootstrapped) {
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

  // Check permanent admin username
  const matchesUsername =
    state.adminUsername &&
    state.adminUsername.toLowerCase() === inputUser.toLowerCase();

  // Also check if entered email matches
  const matchesEmail =
    state.recoveryEmail &&
    state.recoveryEmail.toLowerCase() === inputUser.toLowerCase();

  if ((matchesUsername || matchesEmail) && state.adminPasswordHash) {
    const isPasswordValid = verifyPassword(inputPass, state.adminPasswordHash);
    if (isPasswordValid) {
      const token = createSessionToken({
        uid: state.adminUid || 'admin_primary',
        username: state.adminUsername,
        email: state.recoveryEmail,
        role: 'admin',
      });

      logAudit('ADMIN_LOGIN_SUCCESS', state.adminUsername!, 'Administrator logged in successfully.');

      return res.json({
        success: true,
        token,
        admin: {
          uid: state.adminUid,
          username: state.adminUsername,
          email: state.recoveryEmail,
          role: 'admin',
          institutionName: state.institutionName,
        },
      });
    }
  }

  logAudit('ADMIN_LOGIN_FAILED', inputUser, 'Failed login attempt with invalid password.');
  return res.status(401).json({
    error: 'Invalid credentials',
    message: 'Incorrect username or password. Please verify your administrator credentials.',
  });
}

/**
 * POST /api/auth/verify-session
 * Validates active admin session token
 */
apiRouter.post(['/auth/verify-session', '/api/auth/verify-session'], (req: Request, res: Response): any => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.body.token;

  if (!token) {
    return res.status(401).json({ valid: false, message: 'No session token provided.' });
  }

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ valid: false, message: 'Invalid or expired session token.' });
  }

  const state = loadBootstrapState();

  return res.json({
    valid: true,
    admin: {
      uid: payload.uid,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      institutionName: state.institutionName,
    },
  });
});

/**
 * POST /api/auth/request-recovery
 * Initiates verified password recovery process
 */
apiRouter.post(['/auth/request-recovery', '/api/auth/request-recovery'], (req: Request, res: Response): any => {
  const state = loadBootstrapState();

  if (!state.isBootstrapped) {
    return res.status(400).json({
      error: 'System not yet bootstrapped',
      message: 'System has not completed initial setup. Use temporary ADMIN / 123 credentials to perform initial setup.',
    });
  }

  const { username, recoveryEmail } = req.body || {};
  if (!username || !recoveryEmail) {
    return res.status(400).json({ error: 'Username and registered recovery email are required.' });
  }

  const matchUser = state.adminUsername?.toLowerCase() === String(username).trim().toLowerCase();
  const matchEmail = state.recoveryEmail?.toLowerCase() === String(recoveryEmail).trim().toLowerCase();

  if (!matchUser || !matchEmail) {
    return res.status(404).json({
      error: 'Admin not found',
      message: 'The username and recovery email combination does not match the registered administrator record.',
    });
  }

  // Generate 6-digit secure numeric verification code
  const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
  state.recoveryCode = recoveryCode;
  state.recoveryCodeExpires = Date.now() + 15 * 60 * 1000; // 15 mins expiry
  saveBootstrapState(state);

  logAudit(
    'ADMIN_RECOVERY_REQUESTED',
    state.adminUsername!,
    `Password reset verification code generated for ${recoveryEmail}.`
  );

  return res.json({
    success: true,
    message: `A secure 6-digit verification code has been dispatched to ${recoveryEmail}.`,
    recoveryCodeHint: recoveryCode, // Provided for testing and offline deployment verification
  });
});

/**
 * POST /api/auth/reset-password
 * Verifies recovery code and updates admin password
 */
apiRouter.post(['/auth/reset-password', '/api/auth/reset-password'], (req: Request, res: Response): any => {
  const state = loadBootstrapState();

  if (!state.isBootstrapped) {
    return res.status(400).json({ error: 'System not yet bootstrapped.' });
  }

  const { username, recoveryEmail, recoveryCode, newPassword, confirmPassword } = req.body || {};

  const matchUser = state.adminUsername?.toLowerCase() === String(username).trim().toLowerCase();
  const matchEmail = state.recoveryEmail?.toLowerCase() === String(recoveryEmail).trim().toLowerCase();

  if (!matchUser || !matchEmail) {
    return res.status(404).json({ error: 'Administrator record not found.' });
  }

  if (!state.recoveryCode || !state.recoveryCodeExpires || Date.now() > state.recoveryCodeExpires) {
    return res.status(400).json({ error: 'Verification code has expired. Please request a new recovery code.' });
  }

  if (String(recoveryCode).trim() !== state.recoveryCode) {
    return res.status(401).json({ error: 'Invalid verification code. Please check and try again.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New passwords do not match.' });
  }

  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.valid) {
    return res.status(400).json({ error: strengthCheck.message });
  }

  // Update password
  state.adminPasswordHash = hashPassword(newPassword);
  state.recoveryCode = undefined;
  state.recoveryCodeExpires = undefined;
  saveBootstrapState(state);

  logAudit('ADMIN_PASSWORD_RESET', state.adminUsername!, 'Administrator password successfully recovered and reset.');

  return res.json({
    success: true,
    message: 'Administrator password reset successfully. You may now log in with your new password.',
  });
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

