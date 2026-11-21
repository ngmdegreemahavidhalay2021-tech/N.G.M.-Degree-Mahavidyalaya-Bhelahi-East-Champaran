import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

// Sanitize env var values (guards against accidental literal quotes or trailing JS syntax)
function cleanEnvValue(val: string | undefined, pattern?: RegExp): string | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const cleaned = val
    .trim()
    .replace(/^[`"']+/, '')
    .replace(/[`"';}\s]+$/g, '')
    .trim();
  if (!cleaned) return undefined;
  if (pattern && !pattern.test(cleaned)) return undefined;
  return cleaned;
}

const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};
const env = { ...procEnv, ...metaEnv } as Record<string, string | undefined>;

const hasAppletConfig = Boolean(
  rawConfig?.projectId && rawConfig.projectId !== 'remixed-project-id'
);

const firebaseConfig = {
  projectId:
    (hasAppletConfig ? rawConfig.projectId : undefined) ||
    cleanEnvValue(env.VITE_FIREBASE_PROJECT_ID, /^[a-z0-9-]+$/) ||
    cleanEnvValue(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, /^[a-z0-9-]+$/) ||
    cleanEnvValue(env.FIREBASE_PROJECT_ID, /^[a-z0-9-]+$/) ||
    'vast-archive-1dzcr',
  appId:
    (hasAppletConfig ? rawConfig.appId : undefined) ||
    cleanEnvValue(env.VITE_FIREBASE_APP_ID, /^\d+:\d+:[a-z]+:[a-f0-9]+$/i) ||
    cleanEnvValue(env.NEXT_PUBLIC_FIREBASE_APP_ID, /^\d+:\d+:[a-z]+:[a-f0-9]+$/i) ||
    cleanEnvValue(env.FIREBASE_APP_ID, /^\d+:\d+:[a-z]+:[a-f0-9]+$/i) ||
    '1:85113631348:web:3b58b4185838c3b9049721',
  apiKey:
    (hasAppletConfig ? rawConfig.apiKey : undefined) ||
    cleanEnvValue(env.VITE_FIREBASE_API_KEY, /^AIza[A-Za-z0-9_-]+$/) ||
    cleanEnvValue(env.NEXT_PUBLIC_FIREBASE_API_KEY, /^AIza[A-Za-z0-9_-]+$/) ||
    cleanEnvValue(env.FIREBASE_API_KEY, /^AIza[A-Za-z0-9_-]+$/) ||
    'AIzaSyA66T63kI2_np7ktpIzeDN729ZwyJ19MOg',
  authDomain:
    (hasAppletConfig ? rawConfig.authDomain : undefined) ||
    cleanEnvValue(env.VITE_FIREBASE_AUTH_DOMAIN, /^[a-z0-9.-]+$/i) ||
    cleanEnvValue(env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, /^[a-z0-9.-]+$/i) ||
    cleanEnvValue(env.FIREBASE_AUTH_DOMAIN, /^[a-z0-9.-]+$/i) ||
    'vast-archive-1dzcr.firebaseapp.com',
  firestoreDatabaseId:
    (hasAppletConfig ? rawConfig.firestoreDatabaseId : undefined) ||
    cleanEnvValue(env.VITE_FIREBASE_FIRESTORE_DATABASE_ID, /^[a-z0-9()-]+$/i) ||
    cleanEnvValue(env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID, /^[a-z0-9()-]+$/i) ||
    cleanEnvValue(env.FIREBASE_FIRESTORE_DATABASE_ID, /^[a-z0-9()-]+$/i) ||
    'ai-studio-bf141177-705a-4793-b2bc-644ebb83d388',
  storageBucket:
    (hasAppletConfig ? rawConfig.storageBucket : undefined) ||
    cleanEnvValue(env.VITE_FIREBASE_STORAGE_BUCKET, /^[a-z0-9.-]+$/i) ||
    cleanEnvValue(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, /^[a-z0-9.-]+$/i) ||
    cleanEnvValue(env.FIREBASE_STORAGE_BUCKET, /^[a-z0-9.-]+$/i) ||
    'vast-archive-1dzcr.firebasestorage.app',
  messagingSenderId:
    (hasAppletConfig ? rawConfig.messagingSenderId : undefined) ||
    cleanEnvValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID, /^\d+$/) ||
    cleanEnvValue(env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, /^\d+$/) ||
    cleanEnvValue(env.FIREBASE_MESSAGING_SENDER_ID, /^\d+$/) ||
    '85113631348',
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: The app will break without passing firestoreDatabaseId */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot as required by skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline, check internet connection or configuration.');
    }
    return false;
  }
}

// Auto test
testConnection();
