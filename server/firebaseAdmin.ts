import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import fs from 'node:fs';
import path from 'node:path';

let adminApp: App | null = null;

// Attempt to load client config as fallback
let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch {
  // Ignore
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey && privateKey.includes('\\n')) {
  privateKey = privateKey.replace(/\\n/g, '\n');
}

export function initFirebaseAdmin(): App | null {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  try {
    if (clientEmail && privateKey && projectId) {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('[FirebaseAdmin] Initialized with Service Account Credentials');
    } else if (projectId) {
      adminApp = initializeApp({
        projectId,
      });
      console.log('[FirebaseAdmin] Initialized with Project ID:', projectId);
    }
  } catch (err) {
    console.warn('[FirebaseAdmin] Initialization notice:', (err as Error).message);
  }

  return adminApp;
}

// In-memory persistent state cache for local server operations when direct admin credential is absent
export interface BootstrapState {
  isBootstrapped: boolean;
  adminUsername: string | null;
  adminEmail: string | null;
  adminUid: string | null;
  bootstrappedAt: string | null;
  recoveryEmail: string | null;
  institutionName: string;
  adminPasswordHash?: string;
  recoveryCode?: string;
  recoveryCodeExpires?: number;
}

const STATE_FILE_PATH = path.resolve(process.cwd(), '.bootstrap-state.json');

export function loadBootstrapState(): BootstrapState {
  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const data = fs.readFileSync(STATE_FILE_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Could not read state file, using defaults', err);
  }

  return {
    isBootstrapped: false,
    adminUsername: null,
    adminEmail: null,
    adminUid: null,
    bootstrappedAt: null,
    recoveryEmail: null,
    institutionName: 'NGM Degree Mahavidyalaya',
  };
}

export function saveBootstrapState(state: BootstrapState): void {
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write bootstrap state file:', err);
  }
}
