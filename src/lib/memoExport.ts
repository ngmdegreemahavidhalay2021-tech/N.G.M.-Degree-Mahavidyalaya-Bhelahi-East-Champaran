import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import { MemoSheetData } from '../types/memo';

export function formatMemoSemester(semester: string): string {
  const clean = (semester || '').trim();
  const lower = clean.toLowerCase();
  if (lower === 'semester 1' || lower === '1' || lower === '1st' || lower === 'sem 1') return '1ST';
  if (lower === 'semester 2' || lower === '2' || lower === '2nd' || lower === 'sem 2') return '2ND';
  if (lower === 'semester 3' || lower === '3' || lower === '3rd' || lower === 'sem 3') return '3RD';
  if (lower === 'semester 4' || lower === '4' || lower === '4th' || lower === 'sem 4') return '4TH';
  if (lower === 'semester 5' || lower === '5' || lower === '5th' || lower === 'sem 5') return '5TH';
  if (lower === 'semester 6' || lower === '6' || lower === '6th' || lower === 'sem 6') return '6TH';
  if (lower === 'semester 7' || lower === '7' || lower === '7th' || lower === 'sem 7') return '7TH';
  if (lower === 'semester 8' || lower === '8' || lower === '8th' || lower === 'sem 8') return '8TH';
  return clean.replace(/\bsemester\b/gi, '').trim().toUpperCase() || clean.toUpperCase();
}

export function formatMemoDate(rawDate: string): string {
  const trimmed = (rawDate || '').trim();
  if (!trimmed) return '';
  // Convert ISO YYYY-MM-DD to DD-MM-YYYY for traditional examination sheets
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }
  return trimmed;
}

export function formatProfessorLine(name: string, college: string): string {
  const cleanName = (name || '').trim();
  const cleanCollege = (college || '').trim();
  if (cleanName && cleanCollege) {
    return `${cleanName} (${cleanCollege})`;
  }
  return cleanName || cleanCollege || '';
}

export interface MemoHeaderLines {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
  line5: string;
}

export function buildMemoHeaderLines(sheet: MemoSheetData): MemoHeaderLines {
  const semLabel = formatMemoSemester(sheet.semester);
  const sessLabel = (sheet.session || '').trim();
  const subjLabel = (sheet.subject || '').trim().toUpperCase();
  const catLabel = (sheet.category || 'MJC').trim().toUpperCase();
  const yearLabel = (sheet.examYear || '').trim();

  return {
    line1: `UG CBCS ${semLabel} SEMESTER (${sessLabel}) ${subjLabel} (${catLabel}) PRACTICAL EXAM ${yearLabel}`,
    line2: `COLLEGE + CENTRE :- ${(sheet.collegeCentre || '').trim()}`,
    line3: `DATE :- ${formatMemoDate(sheet.examDate)}`,
    line4: `PROFESSOR 1 :- ${formatProfessorLine(sheet.professor1Name, sheet.professor1College)}`,
    line5: `PROFESSOR 2 :- ${formatProfessorLine(sheet.professor2Name, sheet.professor2College)}`,
  };
}

/**
 * Sorts Roll Numbers in ascending order (numeric ascending for digit-only roll numbers,
 * natural ascending otherwise) while preserving exact original string values (including leading zeros).
 */
export function sortRollNumbersAscending(rollNumbers: string[]): string[] {
  return [...rollNumbers].sort((a, b) => {
    const sa = String(a).trim();
    const sb = String(b).trim();
    const aIsNum = /^\d+$/.test(sa);
    const bIsNum = /^\d+$/.test(sb);
    if (aIsNum && bIsNum) {
      const ba = BigInt(sa);
      const bb = BigInt(sb);
      if (ba < bb) return -1;
      if (ba > bb) return 1;
      return sa.localeCompare(sb);
    }
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Arranges Roll Numbers using strict column-first vertical sequential filling:
 * 1. Filters blanks and sorts all Roll Numbers in ascending order while preserving exact string values.
 * 2. Determines rowsPerColumn dynamically from the layout & student count (minimum 10 boxes per column
 *    when >= 10 students, expanding automatically to ceil(total / columnCount) for larger rosters).
 * 3. Fills Column 1 completely top-to-bottom before starting Column 2, and so on, leaving only
 *    the final populated column partially filled with zero blank gaps between populated columns.
 */
export function buildRollNumberGrid(
  rollNumbers: string[],
  columnCount: 4 | 5,
  templateRowsPerColumn = 10
): string[][] {
  if (!rollNumbers || rollNumbers.length === 0) return [];

  const cleaned = rollNumbers
    .map((r) => String(r ?? '').trim())
    .filter((r) => r.length > 0);
  if (cleaned.length === 0) return [];

  const sorted = sortRollNumbersAscending(cleaned);
  const baseRows = templateRowsPerColumn > 0 ? templateRowsPerColumn : 10;
  const rowsPerColumn =
    sorted.length < baseRows
      ? sorted.length
      : Math.max(baseRows, Math.ceil(sorted.length / columnCount));

  const grid: string[][] = Array.from({ length: rowsPerColumn }, () =>
    Array.from({ length: columnCount }, () => '')
  );

  sorted.forEach((roll, index) => {
    const columnIndex = Math.floor(index / rowsPerColumn);
    const rowIndex = index % rowsPerColumn;
    if (columnIndex < columnCount && rowIndex < rowsPerColumn) {
      grid[rowIndex][columnIndex] = roll;
    }
  });

  return grid;
}

function sanitizeWorksheetName(rawName: string, usedNames: Set<string>): string {
  // Excel sheet names max 31 chars, cannot contain: \ / ? * : [ ]
  let base = rawName.replace(/[\\/?*:[\]]/g, '_').trim() || 'MemoSheet';
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

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates an Excel (.xlsx) workbook with one worksheet per MemoSheetData,
 * preserving Roll Numbers as explicit text strings (with leading zeros),
 * merged header rows, borders, fonts, column widths, row heights, and print setup.
 */
export async function exportMemoSheetsToExcel(
  sheets: MemoSheetData[],
  customFilename?: string
): Promise<void> {
  if (!sheets || sheets.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NGM Degree Mahavidyalaya ERP';
  workbook.created = new Date();

  const usedSheetNames = new Set<string>();
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  sheets.forEach((sheet) => {
    const colCount = sheet.columnCount || 5;
    const rawSheetTitle = `${sheet.subject} (${sheet.category})`;
    const sheetName = sanitizeWorksheetName(rawSheetTitle, usedSheetNames);

    const ws = workbook.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        horizontalCentered: true,
        margins: {
          left: 0.4,
          right: 0.4,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      },
      views: [{ showGridLines: true }],
    });

    // Set uniform generous column widths across all N columns so Roll Numbers never truncate
    const colWidth = colCount === 4 ? 24 : 20;
    ws.columns = Array.from({ length: colCount }, () => ({ width: colWidth }));

    const headers = buildMemoHeaderLines(sheet);
    const lastColLetter = String.fromCharCode(64 + colCount); // 'D' for 4, 'E' for 5

    // Rows 1-5: Top Header Lines
    const headerLines = [
      { text: headers.line1, fontSize: 12, height: 28, align: 'center' as const },
      { text: headers.line2, fontSize: 11, height: 22, align: 'left' as const },
      { text: headers.line3, fontSize: 11, height: 22, align: 'left' as const },
      { text: headers.line4, fontSize: 11, height: 22, align: 'left' as const },
      { text: headers.line5, fontSize: 11, height: 22, align: 'left' as const },
    ];

    headerLines.forEach((hl, idx) => {
      const rowNum = idx + 1;
      const row = ws.getRow(rowNum);
      row.height = hl.height;
      ws.mergeCells(`A${rowNum}:${lastColLetter}${rowNum}`);
      const cell = ws.getCell(`A${rowNum}`);
      cell.value = hl.text;
      cell.font = {
        name: 'Calibri',
        size: hl.fontSize,
        bold: true,
        color: { argb: 'FF000000' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: hl.align,
        wrapText: true,
      };
      // Apply thin outer border around each header line
      for (let c = 1; c <= colCount; c++) {
        ws.getCell(rowNum, c).border = thinBorder;
      }
    });

    // Row 6: Blank spacer row
    const spacerRow = ws.getRow(6);
    spacerRow.height = 12;

    // Rows 7+: Roll Number Grid (ONLY Roll Numbers, preserving exact string & leading zeros)
    const grid = buildRollNumberGrid(sheet.rollNumbers, colCount);
    let currentRowNum = 7;

    grid.forEach((gridRow) => {
      const row = ws.getRow(currentRowNum);
      row.height = 22;
      for (let c = 0; c < colCount; c++) {
        const cell = row.getCell(c + 1);
        const val = gridRow[c];
        // Force string type & text number format so leading zeros are always preserved
        cell.value = val !== '' ? String(val) : '';
        cell.numFmt = '@';
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: false,
          color: { argb: 'FF000000' },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
        cell.border = thinBorder;
      }
      currentRowNum++;
    });

    // Blank spacer row before TOTAL
    ws.getRow(currentRowNum).height = 12;
    currentRowNum++;

    // TOTAL - [NUMBER OF STUDENTS]
    const totalRow = ws.getRow(currentRowNum);
    totalRow.height = 24;
    ws.mergeCells(`A${currentRowNum}:${lastColLetter}${currentRowNum}`);
    const totalCell = ws.getCell(`A${currentRowNum}`);
    totalCell.value = `TOTAL - ${sheet.totalStudents}`;
    totalCell.font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: 'FF000000' },
    };
    totalCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    for (let c = 1; c <= colCount; c++) {
      ws.getCell(currentRowNum, c).border = thinBorder;
    }
    currentRowNum++;

    // Signature Spacing Rows
    ws.getRow(currentRowNum).height = 28;
    currentRowNum++;
    ws.getRow(currentRowNum).height = 28;
    currentRowNum++;

    // Signature Labels Row: TAB - 1 | TAB - 2 | C.S.
    const sigRow = ws.getRow(currentRowNum);
    sigRow.height = 24;
    if (colCount === 4) {
      ws.getCell(currentRowNum, 1).value = 'TAB - 1';
      ws.mergeCells(`B${currentRowNum}:C${currentRowNum}`);
      ws.getCell(currentRowNum, 2).value = 'TAB - 2';
      ws.getCell(currentRowNum, 4).value = 'C.S.';
      [1, 2, 4].forEach((c) => {
        const cell = ws.getCell(currentRowNum, c);
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    } else {
      ws.getCell(currentRowNum, 1).value = 'TAB - 1';
      ws.getCell(currentRowNum, 3).value = 'TAB - 2';
      ws.getCell(currentRowNum, 5).value = 'C.S.';
      [1, 3, 5].forEach((c) => {
        const cell = ws.getCell(currentRowNum, c);
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const first = sheets[0];
  const defaultName =
    sheets.length === 1
      ? `MEMO_${first.subject}_${first.category}_${first.session}_${first.semester}.xlsx`
      : `MEMO_SHEETS_${first.category}_${first.session}_${first.semester}.xlsx`;
  const cleanFileName = (customFilename || defaultName).replace(/\s+/g, '_');

  triggerBlobDownload(blob, cleanFileName);
}

/**
 * Generates a vector-crisp, print-ready PDF matching the traditional Excel Memo Sheet layout.
 * Automatically paginates large roll-number lists without clipping roll numbers or signatures.
 */
export function exportMemoSheetsToPDF(
  sheets: MemoSheetData[],
  customFilename?: string
): void {
  if (!sheets || sheets.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const marginTop = 14;
  const marginBottom = 14;
  const usableWidth = pageWidth - marginX * 2;

  sheets.forEach((sheet, sheetIdx) => {
    if (sheetIdx > 0) {
      doc.addPage();
    }

    const colCount = sheet.columnCount || 5;
    const headers = buildMemoHeaderLines(sheet);
    const grid = buildRollNumberGrid(sheet.rollNumbers, colCount);

    let y = marginTop;

    const drawHeaderBlock = (isContinuation = false) => {
      const lines = isContinuation
        ? [
            { text: `${headers.line1} (CONTD.)`, bold: true, size: 10, align: 'center' as const },
          ]
        : [
            { text: headers.line1, bold: true, size: 10.5, align: 'center' as const },
            { text: headers.line2, bold: true, size: 9.5, align: 'left' as const },
            { text: headers.line3, bold: true, size: 9.5, align: 'left' as const },
            { text: headers.line4, bold: true, size: 9.5, align: 'left' as const },
            { text: headers.line5, bold: true, size: 9.5, align: 'left' as const },
          ];

      lines.forEach((item) => {
        doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
        doc.setFontSize(item.size);
        const wrapped = doc.splitTextToSize(item.text, usableWidth - 4);
        const rowH = Math.max(7, wrapped.length * 4.5 + 2.5);

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.25);
        doc.rect(marginX, y, usableWidth, rowH);

        const textY = y + 4.8;
        if (item.align === 'center') {
          doc.text(wrapped, pageWidth / 2, textY, { align: 'center' });
        } else {
          doc.text(wrapped, marginX + 2.5, textY, { align: 'left' });
        }
        y += rowH;
      });

      y += 4;
    };

    drawHeaderBlock(false);

    // Roll Number Grid
    const colW = usableWidth / colCount;
    const cellH = 7.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);

    grid.forEach((gridRow) => {
      if (y + cellH > pageHeight - marginBottom) {
        doc.addPage();
        y = marginTop;
        drawHeaderBlock(true);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
      }

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.22);

      for (let c = 0; c < colCount; c++) {
        const x = marginX + c * colW;
        doc.rect(x, y, colW, cellH);
        const val = gridRow[c];
        if (val) {
          doc.text(String(val), x + colW / 2, y + 4.9, { align: 'center' });
        }
      }
      y += cellH;
    });

    // Reserve space for TOTAL + Signature section (approx 36mm)
    const footerNeededH = 38;
    if (y + footerNeededH > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }

    y += 4;

    // TOTAL - [N]
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(marginX, y, usableWidth, 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`TOTAL - ${sheet.totalStudents}`, marginX + 2.5, y + 5.5);
    y += 24;

    // Signature line: TAB - 1 | TAB - 2 | C.S.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TAB - 1', marginX + usableWidth * 0.14, y, { align: 'center' });
    doc.text('TAB - 2', marginX + usableWidth * 0.5, y, { align: 'center' });
    doc.text('C.S.', marginX + usableWidth * 0.86, y, { align: 'center' });
  });

  const first = sheets[0];
  const defaultName =
    sheets.length === 1
      ? `MEMO_${first.subject}_${first.category}_${first.session}_${first.semester}.pdf`
      : `MEMO_SHEETS_${first.category}_${first.session}_${first.semester}.pdf`;
  const cleanFileName = (customFilename || defaultName).replace(/\s+/g, '_');

  doc.save(cleanFileName);
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Prints one or multiple Memo Sheets cleanly via an isolated hidden iframe
 * (never uses window.open or alerts).
 */
export function printMemoSheets(sheets: MemoSheetData[]): void {
  if (!sheets || sheets.length === 0) return;

  const sheetPagesHtml = sheets
    .map((sheet, index) => {
      const colCount = sheet.columnCount || 5;
      const headers = buildMemoHeaderLines(sheet);
      const grid = buildRollNumberGrid(sheet.rollNumbers, colCount);

      const gridRowsHtml = grid
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td>${escapeHtml(cell)}</td>`)
              .join('')}</tr>`
        )
        .join('');

      const pageBreakClass = index < sheets.length - 1 ? 'memo-page page-break' : 'memo-page';

      return `
        <div class="${pageBreakClass}">
          <table class="header-table">
            <tr><th class="title-cell">${escapeHtml(headers.line1)}</th></tr>
            <tr><td>${escapeHtml(headers.line2)}</td></tr>
            <tr><td>${escapeHtml(headers.line3)}</td></tr>
            <tr><td>${escapeHtml(headers.line4)}</td></tr>
            <tr><td>${escapeHtml(headers.line5)}</td></tr>
          </table>

          <table class="roll-table cols-${colCount}">
            <tbody>
              ${gridRowsHtml}
            </tbody>
          </table>

          <div class="footer-block">
            <div class="total-box">TOTAL - ${escapeHtml(String(sheet.totalStudents))}</div>
            <div class="signature-row">
              <div class="sig-item">TAB - 1</div>
              <div class="sig-item">TAB - 2</div>
              <div class="sig-item">C.S.</div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>NGM Practical Examination Memo Sheet</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #000000;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .memo-page {
            width: 100%;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .header-table th,
          .header-table td {
            border: 1px solid #000000;
            padding: 5px 8px;
            font-size: 12px;
            font-weight: 700;
            text-align: left;
            line-height: 1.35;
          }
          .header-table .title-cell {
            text-align: center;
            font-size: 13px;
            padding: 7px 8px;
          }
          .roll-table {
            margin-top: 10px;
            table-layout: fixed;
          }
          .roll-table td {
            border: 1px solid #000000;
            padding: 5px 4px;
            text-align: center;
            font-size: 11.5px;
            font-weight: 500;
            height: 24px;
            word-break: break-word;
          }
          .footer-block {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-top: 10px;
          }
          .total-box {
            border: 1px solid #000000;
            padding: 6px 8px;
            font-size: 12.5px;
            font-weight: 700;
            text-align: left;
          }
          .signature-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 46px;
            padding: 0 28px;
          }
          .sig-item {
            font-size: 12.5px;
            font-weight: 700;
            text-align: center;
            min-width: 90px;
          }
        </style>
      </head>
      <body>
        ${sheetPagesHtml}
      </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
  };

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  }, 250);
}
