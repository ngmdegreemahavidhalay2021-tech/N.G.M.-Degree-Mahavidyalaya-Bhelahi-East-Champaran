# Complete College Practical Examination Marks Management System

A production-grade, secure, and complete web application built for colleges, autonomous universities, and academic institutions to manage departmental practical examinations, curriculum subjects, dynamic examination forms (Google Forms style), candidate rosters, verified student selection, individual & bulk marks entry, and multi-sheet Excel / ZIP export.

---

## Technology Stack

- **Frontend**: Next.js / React 19 with TypeScript
- **UI & Styling**: Tailwind CSS (Academic Blue and White Theme)
- **Database**: Firebase Firestore (Permanent Persistent Storage)
- **Authentication**: Firebase Authentication
- **Backend / API**: Server-side API Routes & Express Middleware on Vercel
- **Database Operations**: Firebase Admin SDK
- **Spreadsheet Processing**: SheetJS (`xlsx`) & `jszip`
- **Deployment**: Vercel & GitHub

---

## 1. Initial Admin Bootstrap & Authentication

### First-Time Initialization Credentials:
- **Username**: `ADMIN`
- **Password**: `123`

### Security Lifecycle:
1. The initial credentials function **only** during first-time initialization.
2. Upon authentication, the administrator is redirected immediately to the mandatory **First-Time Admin Setup Page**.
3. The administrator configures a **New Username**, **Strong Password** (minimum 8 chars, uppercase, lowercase, number, symbol), and a **Verified Recovery Email**.
4. The system updates Firestore and permanently disables `ADMIN / 123`.
5. Subsequent logins require the newly configured permanent credentials. Any attempt to use `ADMIN / 123` is blocked with `403 Forbidden`.
6. Public admin registration is strictly forbidden.
7. Verified password recovery mechanism with a 6-digit cryptographic verification code (no backdoor accounts).

---

## 2. Integrated Management Modules (Sidebar Navigation)

1. **Dashboard Overview**:
   - Live statistics: Total Departments, Total Subjects, Total Practical Forms, Total Students, Marks Submitted, Pending Marks Entries, Active Form Links, Closed Forms.
   - Quick action shortcuts and college identity banner.

2. **Department Management**:
   - Add unlimited departments with custom codes (e.g. CS, PHY, CHEM, BCA).
   - Edit and delete departments with confirmation dialogs.
   - View department-wise subjects, examination forms, and enrolled candidates.

3. **Subject Management**:
   - Add unlimited subjects mapped to academic departments.
   - Configure course (B.Sc., BCA, BA, B.Com), semester, section, and subject codes.
   - View all practical examination forms associated with each subject.

4. **Dynamic Practical Form Builder**:
   - Google Forms-style dynamic form creation: Title, Department, Course, Semester, Section, Subject, Code, Exam Name, Academic Year, Maximum Marks, Instructions, Date, Decimal Marks allowed (Yes/No).
   - Unique cryptographically secure access tokens (`?token=...`) per form.
   - Duplicate form, publish, close, reopen, activate/deactivate, regenerate token, and lock/unlock candidate roster.

5. **Student Management**:
   - **Mode A: Manual Student Entry**: Roll Number, Full Name, Department, Course, Semester, Section.
   - **Mode B: Excel / CSV Bulk Upload**: Upload `.xlsx`, `.xls` or `.csv`. Features live preview, row validation, duplicate roll number detection, and sample template download.
   - Permanent `studentId` identity mapping across historical examinations.

6. **Marks Management**:
   - Form selector with real-time statistics (Enrolled, Evaluated, Absent, Pending).
   - **Mode A: Individual Marks Entry**: Fast search by Roll Number or Name, attendance toggle, marks box, save button.
   - **Mode B: Bulk Marks Entry**: Complete candidate table with empty boxes initially, keyboard navigation, bulk save, saved/unsaved status indicator, and pagination.
   - **Candidate Selection & Verification**: Admin selects and verifies student rosters, locks list before sharing with examiners.

7. **Form Link Management**:
   - Directory of all shareable public links with copy button, token regeneration, link preview, and active/disabled toggle.

8. **Advanced Admin Export Center**:
   - Multi-level filters: Department, Subject, Practical Form, Course, Semester, Year, Marks Status (All, Entered, Pending), Search Query.
   - **Single Master Excel Workbook** (`.xlsx`): Unified marks sheet + department-wise summary statistics worksheet.
   - **Department ZIP Archive**: Generates individual `.xlsx` workbooks for each faculty department packed into a single `.zip` file.
   - Browser print layout.

9. **Reports & Analytics**:
   - Department-wise summary and completion rates.
   - Subject & Examination completion diagnostics.
   - Pending marks tracking.

10. **Activity Logs**:
    - Complete audit trail tracking logins, department/subject creation, form generation, token resets, candidate enrollments, and marks evaluations.

11. **Admin Settings**:
    - College institution banner name configuration.
    - Active administrator profile details and recovery email.
    - Strong password change utility.

---

## 3. Public Teacher / Examiner Evaluation Portal (`/?token=...`)

- **No login or account creation required for examiners.**
- Access is strictly isolated by the unique token to that specific examination form.
- Google Forms-style clean academic theme (Blue & White).
- Displays college name, exam title, department, course, subject code, maximum marks, instructions, and verified candidates.
- Supports both **Bulk Marks Entry** and **Individual Candidate Search**.
- Server-side validation: verifies token, active state, published status, non-negative marks, max marks limits, and integer/decimal constraints.

---

## 4. Vercel & GitHub Deployment Walkthrough (18 Steps)

1. **Create Firebase Project**: Open [Firebase Console](https://console.firebase.google.com/), click **Add Project**, name it, and create.
2. **Enable Firestore Database**: In the sidebar, click **Build > Firestore Database**, choose region, start in Production mode.
3. **Deploy Security Rules**: Rules are pre-configured in `firestore.rules`.
4. **Enable Firebase Authentication**: Go to **Build > Authentication**, enable **Email/Password**.
5. **Generate Admin SDK Key**: Go to **Project Settings > Service Accounts**, click **Generate new private key**. Keep it secret.
6. **Set up GitHub Repository**:
   ```bash
   git init
   git add .
   git commit -m "feat: complete College Practical Examination Marks Management System"
   git branch -M main
   git remote add origin https://github.com/your-username/college-practical-marks-erp.git
   git push -u origin main
   ```
7. **Import into Vercel**: Go to [Vercel](https://vercel.com), click **Add New > Project**, select your GitHub repository.
8. **Configure Environment Variables**: Add variables from `.env.example`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `BOOTSTRAP_ADMIN_USERNAME`
   - `BOOTSTRAP_ADMIN_PASSWORD_HASH`
   - `BOOTSTRAP_SETUP_SECRET`
9. **Deploy Application**: Click **Deploy**. Vercel will build the frontend and API functions.
10. **Test Admin Bootstrap**: Access your URL, sign in with `ADMIN / 123`, and configure permanent admin identity.
11. **Verify Credential Retirement**: Verify `ADMIN / 123` is permanently disabled.
12. **Test Departments & Subjects**: Add faculty departments and curriculum subjects.
13. **Test Form Builder**: Build a new practical examination form, duplicate, and toggle publication status.
14. **Test Student Import**: Add candidates manually and upload via sample spreadsheet.
15. **Test Student Verification & Lock**: Verify candidate roster and lock student list.
16. **Test Public Link**: Copy form link and open in an incognito window. Verify examiner entry without login.
17. **Test Marks Entry & Sync**: Enter marks in bulk mode and individual mode. Confirm instant synchronization.
18. **Test Advanced Export Center**: Download multi-sheet Master Excel (`.xlsx`) and Department ZIP archive.

---

## License
Apache-2.0
