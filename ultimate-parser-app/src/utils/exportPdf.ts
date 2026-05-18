import { jsPDF } from 'jspdf';

export function exportTableToPdf(
  title: string,
  headers: string[],
  rows: string[][],
  filename = 'tabla-parser.pdf',
): void {
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  let y = 26;
  const line = headers.join(' | ');
  doc.text(line.slice(0, 120), 14, y);
  y += 6;
  for (const row of rows.slice(0, 80)) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(row.join(' | ').slice(0, 140), 14, y);
    y += 5;
  }
  doc.save(filename);
}

type TableSection = {
  title?: string;
  headers: string[];
  rows: string[][];
};

export function exportMultipleTablesToPdf(
  title: string,
  sections: TableSection[],
  filename = 'tablas.pdf',
): void {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  let y = 26;

  for (const sec of sections) {
    if (sec.title) {
      doc.setFontSize(12);
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(sec.title, 14, y);
      y += 6;
      doc.setFontSize(10);
    }

    const headerLine = sec.headers.join(' | ');
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(headerLine.slice(0, 200), 14, y);
    y += 6;

    for (const row of sec.rows) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(row.join(' | ').slice(0, 300), 14, y);
      y += 5;
    }

    y += 6; // gap between sections
  }

  doc.save(filename);
}
