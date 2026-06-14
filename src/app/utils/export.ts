export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => headers.map(header => JSON.stringify(row[header] ?? '')).join(','))
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
}

export function exportToJSON(data: any[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
}

export function exportToExcel(data: any[], filename: string) {
  // A simplistic version of excel export via TSV, works in Excel
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = [
    headers.join('\t'),
    ...data.map(row => headers.map(header => (row[header]?.toString() || '').replace(/\t/g, ' ')).join('\t'))
  ];
  const blob = new Blob([rows.join('\n')], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xls`;
  a.click();
}

export function exportToPDF(data: any[], filename: string, title = filename) {
  const headers = data.length ? Object.keys(data[0]) : [];
  const lines = [
    title,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    ...(data.length
      ? data.flatMap((row, index) => [
        `Record ${index + 1}`,
        ...headers.flatMap(header => wrapLine(`${header}: ${String(row[header] ?? "")}`, 96)),
        "",
      ])
      : ["No data available."]),
  ];

  const pageLines = chunk(lines, 54);
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 40;
  const topY = 800;
  const lineHeight = 14;

  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const fontObjectId = 3;
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = "<< /Type /Pages /Kids [] /Count 0 >>";
  objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pageLines.forEach((page, pageIndex) => {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);

    const content = page.map((line, lineIndex) => {
      const fontSize = pageIndex === 0 && lineIndex === 0 ? 16 : 9;
      const y = topY - (lineIndex * lineHeight);
      return `BT /F1 ${fontSize} Tf ${marginX} ${y} Td (${escapePdfText(line)}) Tj ET`;
    }).join("\n");

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefStart = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([body], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.pdf`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function wrapLine(line: string, maxLength: number) {
  const clean = line.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return [clean];

  const parts: string[] = [];
  let remaining = clean;
  while (remaining.length > maxLength) {
    const cut = remaining.lastIndexOf(" ", maxLength);
    const sliceAt = cut > 40 ? cut : maxLength;
    parts.push(remaining.slice(0, sliceAt));
    remaining = remaining.slice(sliceAt).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function escapePdfText(text: string) {
  return text
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
