import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Copy,
  ExternalLink,
  Flame,
  Github,
  Globe,
  Key,
  Shield,
  Terminal,
  FileSpreadsheet,
  Cpu,
  Layers,
} from 'lucide-react';

interface DeploymentGuideModalProps {
  onClose: () => void;
}

export const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'firebase' | 'github' | 'vercel' | 'testing'>('firebase');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100">
                Production Deployment & Configuration Manual
              </h2>
              <p className="text-xs text-slate-400">
                Mandatory 11-step checklist for Firebase, GitHub repository & Vercel deployment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none p-1.5 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 px-6 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'firebase'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-500" />
            <span>Steps 1–4: Firebase Configuration</span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'github'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-4 h-4 text-slate-300" />
            <span>Step 5: GitHub Repository</span>
          </button>
          <button
            onClick={() => setActiveTab('vercel')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'vercel'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Steps 6–8: Vercel Deployment</span>
          </button>
          <button
            onClick={() => setActiveTab('testing')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'testing'
                ? 'border-purple-400 text-purple-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle className="w-4 h-4 text-purple-400" />
            <span>Steps 9–11: Verification & Testing</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {activeTab === 'firebase' && (
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-center font-bold">1</span>
                  Creating Firebase Project
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-1">Firebase Console <ExternalLink className="w-3 h-3" /></a>, click <strong>"Add Project"</strong>, name it (e.g. <code>practical-exam-erp</code>), and disable Google Analytics (optional).
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-center font-bold">2</span>
                  Enabling Firestore Database
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">
                  In Firebase console sidebar, navigate to <strong>Build &gt; Firestore Database</strong>. Click <strong>Create database</strong>, choose your preferred cloud region, and select production mode.
                </p>
                <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 flex items-center justify-between border border-slate-800">
                  <span>Deploy rules: firestore.rules (included in repository)</span>
                  <button
                    onClick={() => copyToClipboard('rules_version = \'2\';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} { allow read, write: if false; }\n  }\n}', 'rules')}
                    className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedKey === 'rules' ? 'Copied!' : 'Copy Rules'}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-center font-bold">3</span>
                  Enabling Firebase Authentication
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Navigate to <strong>Build &gt; Authentication</strong>. Click <strong>Get Started</strong>. Under <strong>Sign-in method</strong>, enable <strong>Email/Password</strong> and <strong>Google</strong> (if desired).
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-center font-bold">4</span>
                  Configuring Firebase Admin SDK
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">
                  Navigate to <strong>Project Settings (gear icon) &gt; Service Accounts</strong>. Click <strong>"Generate new private key"</strong>. Securely store the downloaded JSON file.
                </p>
                <p className="text-xs text-rose-400 font-medium">
                  ⚠️ Never upload this private key or JSON file to GitHub. Add the values into Vercel Environment Variables.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-center font-bold">5</span>
                  Creating and Uploading the GitHub Repository
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  Initialize and push the repository to GitHub. Strict <code>.gitignore</code> rules prevent credentials and local state from leaking.
                </p>

                <div className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-emerald-300 space-y-1 border border-slate-800 overflow-x-auto">
                  <p># Initialize local Git tracking</p>
                  <p>git init</p>
                  <p>git add .</p>
                  <p>git commit -m "feat: complete Practical Examination Marks Management System with bootstrap"</p>
                  <p># Link your remote repository and push</p>
                  <p>git branch -M main</p>
                  <p>git remote add origin https://github.com/your-username/practical-exam-marks-system.git</p>
                  <p>git push -u origin main</p>
                </div>

                <div className="mt-3 p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-300">
                  <span className="font-semibold text-slate-200">Included Repository Manifest:</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
                    <li>Full TypeScript source code with Tailwind styling</li>
                    <li><code>package.json</code> with all dependencies</li>
                    <li><code>README.md</code> with full setup documentation</li>
                    <li><code>vercel.json</code> configured for single-page app and API routing</li>
                    <li><code>firestore.rules</code> and <code>firebase-blueprint.json</code></li>
                    <li>Hardened <code>.gitignore</code> protecting <code>.env*</code> and private keys</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vercel' && (
            <div className="space-y-6">
              {/* Step 6 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-center font-bold">6</span>
                  Importing the Repository into Vercel
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Log in to <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-1">Vercel Dashboard <ExternalLink className="w-3 h-3" /></a>. Click <strong>"Add New... &gt; Project"</strong>, select your GitHub repository and click <strong>"Import"</strong>. Framework preset will automatically detect Vite.
                </p>
              </div>

              {/* Step 7 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-center font-bold">7</span>
                    Adding Required Environment Variables in Vercel
                  </div>
                  <button
                    onClick={() => copyToClipboard(`VITE_FIREBASE_PROJECT_ID=""\nVITE_FIREBASE_API_KEY=""\nVITE_FIREBASE_AUTH_DOMAIN=""\nVITE_FIREBASE_FIRESTORE_DATABASE_ID="(default)"\nVITE_FIREBASE_STORAGE_BUCKET=""\nVITE_FIREBASE_MESSAGING_SENDER_ID=""\nVITE_FIREBASE_APP_ID=""\nFIREBASE_PROJECT_ID=""\nFIREBASE_CLIENT_EMAIL=""\nFIREBASE_PRIVATE_KEY=""\nADMIN_BOOTSTRAP_INITIAL_USERNAME="ADMIN"\nADMIN_BOOTSTRAP_INITIAL_PASSWORD="123"`, 'env')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedKey === 'env' ? 'Copied Template!' : 'Copy Env Template'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-3">
                  Under Vercel project settings &gt; <strong>Environment Variables</strong>, add the following variables:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-indigo-300">VITE_FIREBASE_PROJECT_ID</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-indigo-300">VITE_FIREBASE_API_KEY</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-indigo-300">VITE_FIREBASE_AUTH_DOMAIN</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-indigo-300">VITE_FIREBASE_APP_ID</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-emerald-300">FIREBASE_CLIENT_EMAIL</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-emerald-300">FIREBASE_PRIVATE_KEY</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-amber-300">ADMIN_BOOTSTRAP_INITIAL_USERNAME</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-amber-300">ADMIN_BOOTSTRAP_INITIAL_PASSWORD</span>
                  </div>
                </div>
              </div>

              {/* Step 8 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-center font-bold">8</span>
                  Deploying the Website
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click <strong>Deploy</strong>. Vercel will run <code>npm run build</code>, create the optimized bundle, and deploy the serverless API routes with your production domain (e.g. <code>https://practical-exam-erp.vercel.app</code>).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'testing' && (
            <div className="space-y-6">
              {/* Step 9 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-purple-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-center font-bold">9</span>
                  Testing Admin Login & Bootstrap Retirement
                </div>
                <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                  <li>Visit your deployed application URL.</li>
                  <li>Click <strong>"Administrator Login"</strong> and enter initial temporary credentials: <code>Username: ADMIN</code>, <code>Password: 123</code>.</li>
                  <li>Verify that the application immediately routes to the <strong>First-Time Admin Setup Page</strong>.</li>
                  <li>Configure permanent username, strong password, and recovery email. Click complete.</li>
                  <li>Log out and attempt to log in using <code>ADMIN / 123</code>. Confirm the system rejects it with an explicit security notice that bootstrap credentials are permanently disabled.</li>
                  <li>Log in using your newly configured permanent credentials to verify success.</li>
                </ul>
              </div>

              {/* Step 10 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-purple-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-center font-bold">10</span>
                  Testing Public Practical Form Links
                </div>
                <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                  <li>In the Admin Dashboard, click <strong>"Create Practical Exam"</strong> (e.g. Computer Networks Practical).</li>
                  <li>Click <strong>"Copy Examiner Link"</strong> from the exam card.</li>
                  <li>Open an incognito or private browsing window and paste the examiner evaluation link.</li>
                  <li>Verify that the examiner can access the evaluation portal without needing administrator credentials.</li>
                </ul>
              </div>

              {/* Step 11 */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-2 text-purple-400 font-semibold mb-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs flex items-center justify-center font-bold">11</span>
                  Testing Marks Entry and Excel Export
                </div>
                <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                  <li>On the evaluation sheet, mark attendance (Present / Absent) and enter criterion marks for each candidate.</li>
                  <li>Observe real-time calculation of total marks, percentages, and pass/fail badges.</li>
                  <li>Click <strong>"Save / Submit Marks"</strong>.</li>
                  <li>Click <strong>"Export Official Excel (.xlsx)"</strong> and open the downloaded spreadsheet.</li>
                  <li>Verify that the Excel marksheet includes college name, degree, subject code, candidate marks, statistics summary, and signature lines for internal/external examiners.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Complies with zero-trust Firestore ABAC and Vercel serverless specifications.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
