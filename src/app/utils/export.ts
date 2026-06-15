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

export function exportToPDF(_data: any[], filename: string, title = filename) {
  const exportRoot = document.querySelector("[data-pdf-export-root]");
  const main = document.querySelector("main");
  const source = (exportRoot || main || document.body) as HTMLElement;
  const clone = source.cloneNode(true) as HTMLElement;
  syncFormState(source, clone);

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join("\n");
  const printWindow = window.open("", "_blank", "width=1440,height=1000");

  if (!printWindow) {
    document.title = filename;
    window.print();
    return;
  }

  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(filename)}</title>
    ${styles}
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { min-height: 100%; background: hsl(var(--background)); color: hsl(var(--foreground)); }
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .pdf-document { min-height: 100vh; background: hsl(var(--background)); padding: 24px; }
      .pdf-document [data-pdf-export-root] { height: auto !important; min-height: auto !important; overflow: visible !important; }
      .pdf-document .h-screen, .pdf-document .h-full, .pdf-document .max-h-\\[90vh\\], .pdf-document .h-\\[520px\\] { height: auto !important; max-height: none !important; }
      .pdf-document .overflow-auto, .pdf-document .overflow-y-auto, .pdf-document .overflow-x-auto { overflow: visible !important; }
      .pdf-document .sticky { position: static !important; }
      .pdf-document table { page-break-inside: auto; }
      .pdf-document tr, .pdf-document .rounded-xl, .pdf-document .rounded-lg { break-inside: avoid; page-break-inside: avoid; }
      .pdf-title { margin: 0 0 16px; color: hsl(var(--foreground)); font-size: 20px; font-weight: 700; }
      @media print {
        body { width: 100%; }
        .pdf-document { padding: 0; }
        button, [role="button"] { box-shadow: none !important; }
      }
    </style>
  </head>
  <body>
    <main class="pdf-document">
      <h1 class="pdf-title">${escapeHtml(title)}</h1>
      ${clone.outerHTML}
    </main>
    <script>
      window.addEventListener("load", () => {
        setTimeout(() => {
          window.focus();
          window.print();
        }, 450);
      });
    </script>
  </body>
</html>`);
  printWindow.document.close();
}

function syncFormState(sourceRoot: Element, cloneRoot: Element) {
  const sourceFields = sourceRoot.querySelectorAll("input, textarea, select");
  const cloneFields = cloneRoot.querySelectorAll("input, textarea, select");

  sourceFields.forEach((field, index) => {
    const clone = cloneFields[index];
    if (!clone) return;

    if (field instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
      if (field.type === "checkbox" || field.type === "radio") {
        clone.checked = field.checked;
        if (field.checked) clone.setAttribute("checked", "checked");
        else clone.removeAttribute("checked");
      } else {
        clone.value = field.value;
        clone.setAttribute("value", field.value);
      }
      return;
    }

    if (field instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
      clone.value = field.value;
      clone.textContent = field.value;
      return;
    }

    if (field instanceof HTMLSelectElement && clone instanceof HTMLSelectElement) {
      clone.value = field.value;
      Array.from(clone.options).forEach(option => {
        option.selected = option.value === field.value;
        if (option.selected) option.setAttribute("selected", "selected");
        else option.removeAttribute("selected");
      });
    }
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
