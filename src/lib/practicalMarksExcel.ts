import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { SubjectType } from '../types';
import { PracticalCategorySheetPayload } from '../types/practicalMarksGenerator';

export const OFFICIAL_DEFAULT_COLLEGE_NAME = 'NGM DEGREE COLLEGE, BHELAHI';
export const UNIVERSITY_HEADING = 'B.R.A. BIHAR UNIVERSITY, MUZAFFARPUR';

export function formatOrdinalSemesterForPracticalSheet(semester: string): string {
  const clean = (semester || '').trim();
  const lower = clean.toLowerCase();
  if (lower === 'semester 1' || lower === '1' || lower === '1st' || lower === 'sem 1') return '1st';
  if (lower === 'semester 2' || lower === '2' || lower === '2nd' || lower === 'sem 2') return '2nd';
  if (lower === 'semester 3' || lower === '3' || lower === '3rd' || lower === 'sem 3') return '3rd';
  if (lower === 'semester 4' || lower === '4' || lower === '4th' || lower === 'sem 4') return '4th';
  if (lower === 'semester 5' || lower === '5' || lower === '5th' || lower === 'sem 5') return '5th';
  if (lower === 'semester 6' || lower === '6' || lower === '6th' || lower === 'sem 6') return '6th';
  if (lower === 'semester 7' || lower === '7' || lower === '7th' || lower === 'sem 7') return '7th';
  if (lower === 'semester 8' || lower === '8' || lower === '8th' || lower === 'sem 8') return '8th';
  const match = /(\d+)/.exec(clean);
  if (match) {
    const n = Number(match[1]);
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return `${n}th`;
  }
  return clean;
}

export function getMainSheetName(category: SubjectType, fullMarks: number): string {
  const fmLabel = Number.isInteger(fullMarks) ? String(fullMarks) : String(fullMarks);
  const prefix = category === 'MJC' ? 'Major' : category === 'MIC' ? 'Minor' : 'MDC';
  return `${prefix} Pr_${fmLabel}`.slice(0, 31);
}

export function buildPracticalSheetHeaders(payload: PracticalCategorySheetPayload) {
  const ordSem = formatOrdinalSemesterForPracticalSheet(payload.semester);
  const fmLabel = Number.isInteger(payload.fullMarks)
    ? String(payload.fullMarks)
    : String(payload.fullMarks);
  const college = (payload.collegeName || OFFICIAL_DEFAULT_COLLEGE_NAME).trim().toUpperCase();

  return {
    row1: UNIVERSITY_HEADING,
    row2: `Name of the Examination:- UG ${ordSem} Sem. (${payload.session}) under the CBCS Programme.`,
    row3: `College Name :- ${college}`,
    row4: 'Practical Marks',
    col1Header: `Subject : ${payload.category} (Practical)`,
    col2Header: 'Roll No.',
    col3Header: `Marks Obtained (F.M.-${fmLabel})`,
  };
}

function sanitizeSheetNameUnique(rawName: string, usedNames: Set<string>): string {
  let base = rawName.replace(/[\\/?*:[\]]/g, '_').trim() || 'PracticalSheet';
  if (base.length > 31) base = base.slice(0, 31).trim();
  let candidate = base;
  let counter = 2;
  while (usedNames.has(candidate.toUpperCase())) {
    const suffix = `_${counter}`;
    candidate = base.slice(0, Math.max(1, 31 - suffix.length)) + suffix;
    counter++;
  }
  usedNames.add(candidate.toUpperCase());
  return candidate;
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

function appendOfficialPracticalWorksheet(
  workbook: ExcelJS.Workbook,
  payload: PracticalCategorySheetPayload,
  usedNames: Set<string>
) {
  const sheetName = sanitizeSheetNameUnique(
    getMainSheetName(payload.category, payload.fullMarks),
    usedNames
  );
  const headers = buildPracticalSheetHeaders(payload);

  const ws = workbook.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.45,
        right: 0.45,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ showGridLines: true }],
  });

  ws.columns = [
    { width: 28 },
    { width: 22 },
    { width: 30 },
  ];

  const topRows = [
    { text: headers.row1, size: 13, height: 26 },
    { text: headers.row2, size: 11, height: 22 },
    { text: headers.row3, size: 11, height: 22 },
    { text: headers.row4, size: 12, height: 22 },
  ];

  topRows.forEach((info, idx) => {
    const rowNum = idx + 1;
    const row = ws.getRow(rowNum);
    row.height = info.height;
    ws.mergeCells(`A${rowNum}:C${rowNum}`);
    const cell = ws.getCell(`A${rowNum}`);
    cell.value = info.text;
    cell.font = {
      name: 'Calibri',
      size: info.size,
      bold: true,
      color: { argb: 'FF000000' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    for (let c = 1; c <= 3; c++) {
      ws.getCell(rowNum, c).border = THIN_BORDER;
    }
  });

  // Row 5: Table Headers
  const headerRow = ws.getRow(5);
  headerRow.height = 26;
  const colHeaders = [headers.col1Header, headers.col2Header, headers.col3Header];
  colHeaders.forEach((text, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = text;
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF000000' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = THIN_BORDER;
  });

  // Row 6+: Student Marks Rows
  payload.rows.forEach((item, index) => {
    const row = ws.getRow(6 + index);
    row.height = 20;

    // Col 1: Subject
    const c1 = row.getCell(1);
    c1.value = item.subject;
    c1.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
    c1.alignment = { vertical: 'middle', horizontal: 'left' };
    c1.border = THIN_BORDER;

    // Col 2: Roll No. (strict text format to preserve leading zeros)
    const c2 = row.getCell(2);
    c2.value = String(item.rollNumber ?? '').trim();
    c2.numFmt = '@';
    c2.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
    c2.alignment = { vertical: 'middle', horizontal: 'center' };
    c2.border = THIN_BORDER;

    // Col 3: Marks Obtained (numeric when available, 'ABSENT' when absent, '' when missing)
    const c3 = row.getCell(3);
    if (item.status === 'PRESENT' && item.rawMarksObtained !== null && Number.isFinite(item.rawMarksObtained)) {
      c3.value = item.rawMarksObtained;
      c3.numFmt = Number.isInteger(item.rawMarksObtained) ? '0' : '0.##';
    } else if (item.status === 'ABSENT') {
      c3.value = 'ABSENT';
    } else {
      c3.value = '';
    }
    c3.font = {
      name: 'Calibri',
      size: 11,
      bold: item.status === 'ABSENT',
      color: { argb: item.exceedsFm || item.isInvalid ? 'FFB91C1C' : 'FF000000' },
    };
    c3.alignment = { vertical: 'middle', horizontal: 'center' };
    c3.border = THIN_BORDER;
  });
}

/**
 * Builds an Excel (.xlsx) workbook buffer from one or more non-empty category payloads
 * containing only Official Practical Marks sheets (Major / Minor / MDC).
 * Never creates empty category worksheets.
 */
export async function buildPracticalMarksWorkbookBuffer(
  payloads: PracticalCategorySheetPayload[]
): Promise<Uint8Array> {
  const nonEmpty = payloads.filter((p) => p.rows.length > 0);
  if (nonEmpty.length === 0) {
    throw new Error('No practical marks records available to build Excel file.');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NGM Degree Mahavidyalaya ERP';
  workbook.created = new Date();
  const usedNames = new Set<string>();

  nonEmpty.forEach((p) => appendOfficialPracticalWorksheet(workbook, p, usedNames));

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(arrayBuffer as ArrayBuffer);
}

export function buildPracticalExportFilename(params: {
  kind: 'SINGLE_CATEGORY' | 'ALL_COMBINED' | 'ZIP_ARCHIVE';
  category?: SubjectType;
  session: string;
  semester: string;
}): string {
  const sess = (params.session || 'Session').trim().replace(/\s+/g, '-');
  const sem = (params.semester || 'Semester').trim().replace(/\s+/g, '-');

  if (params.kind === 'ZIP_ARCHIVE') {
    return `Practical_Marks_Archive_${sess}_${sem}.zip`;
  }
  if (params.kind === 'ALL_COMBINED') {
    return `All_Practical_Marks_${sess}_${sem}.xlsx`;
  }

  const catLabel =
    params.category === 'MJC'
      ? 'Major'
      : params.category === 'MIC'
        ? 'Minor'
        : 'MDC';
  return `${catLabel}_Practical_${sess}_${sem}.xlsx`;
}

function triggerBrowserDownload(bytes: Uint8Array, mimeType: string, filename: string) {
  const blob = new Blob([bytes.slice().buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPracticalMarksWorkbook(
  payloads: PracticalCategorySheetPayload[],
  filename: string
): Promise<void> {
  const bytes = await buildPracticalMarksWorkbookBuffer(payloads);
  triggerBrowserDownload(
    bytes,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename
  );
}

export async function buildPracticalMarksZipBuffer(
  payloads: PracticalCategorySheetPayload[]
): Promise<Uint8Array> {
  const nonEmpty = payloads.filter((p) => p.rows.length > 0);
  if (nonEmpty.length === 0) {
    throw new Error('No practical marks records available for ZIP export.');
  }

  const zip = new JSZip();
  for (const p of nonEmpty) {
    const fileBytes = await buildPracticalMarksWorkbookBuffer([p]);
    const fileName = buildPracticalExportFilename({
      kind: 'SINGLE_CATEGORY',
      category: p.category,
      session: p.session,
      semester: p.semester,
    });
    zip.file(fileName, fileBytes);
  }

  return await zip.generateAsync({ type: 'uint8array' });
}

export async function downloadPracticalMarksZip(
  payloads: PracticalCategorySheetPayload[],
  session: string,
  semester: string
): Promise<void> {
  const bytes = await buildPracticalMarksZipBuffer(payloads);
  const filename = buildPracticalExportFilename({
    kind: 'ZIP_ARCHIVE',
    session,
    semester,
  });
  triggerBrowserDownload(bytes, 'application/zip', filename);
}
