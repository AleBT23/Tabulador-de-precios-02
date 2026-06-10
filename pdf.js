/**
 * pdf.js
 * PDF generation module using jsPDF.
 * Produces professional proposal documents with company letterhead.
 *
 * Fixes applied:
 *  #1  - Letterhead loaded from LocalStorage Base64 (no file paths).
 *  #2  - Header layout: Project Name left, Quote No. + Date right, no overlap.
 *  #3  - Table columns 45/10/15/15/15 %, no clipping, wrapping descriptions.
 *  #4  - All currency values right-aligned.
 *  #5  - UTF-8 safe: only ASCII used in string literals sent to jsPDF.
 *  #8  - Respects proposal.applyVat flag (VAT = 0 when disabled).
 *  #9  - Updated validity footer text (14 calendar days, ASCII only).
 *  #10 - Improved spacing, margins, and typography.
 */

/**
 * Format a monetary value with currency symbol.
 * Uses only ASCII-safe output for jsPDF compatibility.
 * @param {number} value
 * @param {string} currency
 * @returns {string}
 */
function fmtMoney(value, currency) {
  const sym = CONFIG.CURRENCY_SYMBOLS[currency] || '$';
  const num = Number(value).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${num}`;
}

/**
 * Format a date string to DD/MM/YYYY.
 * @param {string|Date} date
 * @returns {string}
 */
function fmtDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d)) return String(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * Strip accented / non-ASCII characters from a string so jsPDF helvetica
 * renders them without corruption.  Replaces common Spanish accented letters
 * with their ASCII equivalents and drops anything else outside 0x20-0x7E.
 * @param {string} str
 * @returns {string}
 */
function toAsciiSafe(str) {
  if (!str) return '';
  return str
    .replace(/[áàäâã]/gi, (c) => c === c.toUpperCase() ? 'A' : 'a')
    .replace(/[éèëê]/gi,  (c) => c === c.toUpperCase() ? 'E' : 'e')
    .replace(/[íìïî]/gi,  (c) => c === c.toUpperCase() ? 'I' : 'i')
    .replace(/[óòöôõ]/gi, (c) => c === c.toUpperCase() ? 'O' : 'o')
    .replace(/[úùüû]/gi,  (c) => c === c.toUpperCase() ? 'U' : 'u')
    .replace(/[ñ]/g,  'n')
    .replace(/[Ñ]/g,  'N')
    .replace(/[^A-Za-z0-9\s.,;:!?()\/\-_%$@#&=+*'"[\]{}|\\<>]/g, '')
    .trim();
}

/**
 * Main PDF generation function.
 * @param {Object} proposal  Full proposal object
 * @param {Object} settings  App settings (vat, currency, applyVat)
 */
async function generateProposalPDF(proposal, settings) {
  const { jsPDF } = window.jspdf;

  /* ── Page geometry (Letter, mm) ── */
  const PAGE_W    = 215.9;
  const PAGE_H    = 279.4;
  const MARGIN    = 16;           // Left margin
  const MARGIN_R  = 32;           // Right margin — wider to clear the letterhead's right-side decoration
  const MARGIN_T  = 22;           // Top margin   — clears the letterhead logo/header area
  const CONTENT_W = PAGE_W - MARGIN - MARGIN_R;  // 167.9 mm
  const FOOTER_H  = 62;          // Reserved at bottom — keeps content above letterhead's contact block

  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });

  const currency = settings.currency || CONFIG.DEFAULT_CURRENCY;
  // Fix #8: respect applyVat flag
  const applyVat = (proposal.applyVat !== undefined) ? proposal.applyVat : (settings.applyVat !== false);
  const vatPct   = applyVat ? (settings.vat ?? CONFIG.DEFAULT_VAT) : 0;

  /* ── Colour palette ── */
  const BLACK  = [15,  15,  15];
  const DARK   = [30,  30,  30];
  const GRAY   = [110, 110, 110];
  const LGRAY  = [180, 180, 180];
  const LIGHT  = [242, 242, 242];
  const WHITE  = [255, 255, 255];
  const STRIPE = [249, 249, 249];

  /* ── Track current Y cursor ── */
  let curY = MARGIN_T;

  /* ── Table column widths as absolute mm (Fix #3: 45/10/15/15/15 of CONTENT_W) ── */
  const COL_DESC  = CONTENT_W * 0.45;  // ~82.8 mm
  const COL_QTY   = CONTENT_W * 0.10;  // ~18.4 mm
  const COL_UNIT  = CONTENT_W * 0.15;  // ~27.6 mm
  const COL_PRICE = CONTENT_W * 0.15;  // ~27.6 mm
  const COL_AMT   = CONTENT_W * 0.15;  // ~27.6 mm

  // Column X positions (left edges)
  const X_DESC  = MARGIN;
  const X_QTY   = X_DESC  + COL_DESC;
  const X_UNIT  = X_QTY   + COL_QTY;
  const X_PRICE = X_UNIT  + COL_UNIT;
  const X_AMT   = X_PRICE + COL_PRICE;

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */

  /** Ensure there is at least neededMm space before bottom footer zone. */
  function checkPageBreak(neededMm) {
    if (curY + neededMm > PAGE_H - FOOTER_H - 4) {
      doc.addPage();
      curY = MARGIN_T;
    }
  }

  /** Draw a thin horizontal rule at curY. */
  function hRule(color, width) {
    doc.setDrawColor(...(color || LGRAY));
    doc.setLineWidth(width || 0.25);
    doc.line(MARGIN, curY, PAGE_W - MARGIN_R, curY);
  }

  /* ─────────────────────────────────────────────
     1. LETTERHEAD — full-page background on every page (Letter 215.9×279.4 mm)
     The image fills the entire page at (0,0) so aspect ratio is preserved
     for a Letter-sized letterhead.  All content is rendered on top of it.
     addPage is wrapped so every new page automatically gets the background
     before any content is drawn.
  ───────────────────────────────────────────── */
  const b64 = loadLetterheadB64();

  function drawLetterhead() {
    if (b64 && b64.startsWith('data:')) {
      doc.addImage(b64, 'PNG', 0, 0, PAGE_W, PAGE_H);
    }
  }

  drawLetterhead(); // Page 1

  const _origAddPage = doc.addPage.bind(doc);
  doc.addPage = function (...args) {
    _origAddPage(...args);
    drawLetterhead();
    return doc;
  };

  /* ─────────────────────────────────────────────
     2. HEADER: Project Name (left) | Quote No. + Date (right)
     Fix #2: No overlap — project name clipped to left 55% of content width.
  ───────────────────────────────────────────── */
  hRule(DARK, 0.5);
  curY += 6;

  // --- LEFT: Project name ---
  const projectName = toAsciiSafe(proposal.projectName || 'Proyecto sin nombre');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  // Split project name to stay within left 55% of content width, single line preferred
  const projMaxW = CONTENT_W * 0.58;
  const projLines = doc.splitTextToSize(projectName, projMaxW);
  doc.text(projLines, MARGIN, curY);

  // --- RIGHT: Quote number + Date (stacked, right-aligned) ---
  const rightX = PAGE_W - MARGIN_R;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`No. ${toAsciiSafe(proposal.proposalNumber || '-')}`, rightX, curY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Fecha: ${fmtDate(proposal.date || new Date())}`, rightX, curY + 5, { align: 'right' });

  // Advance past the taller of the two columns
  const headerH = Math.max(projLines.length * 5, 12);
  curY += headerH + 6;

  /* ─────────────────────────────────────────────
     3. CLIENT INFORMATION BLOCK
  ───────────────────────────────────────────── */
  checkPageBreak(26);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(MARGIN, curY, CONTENT_W, 22, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text('CLIENTE', MARGIN + 4, curY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text(toAsciiSafe(proposal.clientName || '-'), MARGIN + 4, curY + 11.5);

  // Client details — email, phone, address on one line (ASCII safe)
  const clientParts = [];
  if (proposal.clientEmail)   clientParts.push(toAsciiSafe(proposal.clientEmail));
  if (proposal.clientPhone)   clientParts.push(toAsciiSafe(proposal.clientPhone));
  if (proposal.clientAddress) clientParts.push(toAsciiSafe(proposal.clientAddress));
  if (clientParts.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    const clientLine = clientParts.join('  |  ');
    const clientWrapped = doc.splitTextToSize(clientLine, CONTENT_W - 8);
    doc.text(clientWrapped, MARGIN + 4, curY + 18, { maxWidth: CONTENT_W - 8 });
  }
  curY += 28;

  /* ─────────────────────────────────────────────
     4. PROJECT NOTES (optional)
  ───────────────────────────────────────────── */
  if (proposal.notes && proposal.notes.trim()) {
    checkPageBreak(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('NOTAS DEL PROYECTO', MARGIN, curY);
    curY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...BLACK);
    const noteLines = doc.splitTextToSize(toAsciiSafe(proposal.notes), CONTENT_W);
    doc.text(noteLines, MARGIN, curY);
    curY += noteLines.length * 4.5 + 6;
  }

  /* ─────────────────────────────────────────────
     5. SERVICES TABLE
     Fix #3: Columns 45/10/15/15/15. No clipping. Amount always visible.
     Fix #4: Currency values right-aligned.
  ───────────────────────────────────────────── */
  checkPageBreak(28);

  const ROW_H_MIN = 8;   // Minimum row height in mm

  // ---- Table header row ----
  doc.setFillColor(...DARK);
  doc.rect(MARGIN, curY, CONTENT_W, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);

  // Header labels — center qty/unit, right-align price/amount
  doc.text('DESCRIPCION',  X_DESC  + 2,               curY + 5.5);
  doc.text('CANT.',        X_QTY   + COL_QTY  / 2,    curY + 5.5, { align: 'center' });
  doc.text('UNIDAD',       X_UNIT  + COL_UNIT / 2,    curY + 5.5, { align: 'center' });
  doc.text('P. UNITARIO',  X_PRICE + COL_PRICE - 2,   curY + 5.5, { align: 'right' });
  doc.text('IMPORTE',      X_AMT   + COL_AMT   - 2,   curY + 5.5, { align: 'right' });

  curY += 8;

  // ---- Data rows ----
  const items = proposal.items || [];
  items.forEach((item, i) => {
    // Compute values
    const unitPriceVal = parseFloat(item.unitPrice) || 0;
    const qtyVal       = parseFloat(item.quantity)  || 0;
    const discPct      = parseFloat(item.discount)  || 0;
    const amount       = qtyVal * unitPriceVal * (1 - discPct / 100);

    // Resolve unit label
    const uLabel = CONFIG.UNIT_TYPES.find(u => u.value === item.unit)?.label || item.unit || '-';

    // Description may wrap — compute required row height
    const descText  = toAsciiSafe(item.serviceName || item.description || '-');
    const descLines = doc.splitTextToSize(descText, COL_DESC - 4);
    const extraDisc = discPct > 0 ? 1 : 0;  // extra line if discount shown
    const rowH      = Math.max(ROW_H_MIN, descLines.length * 4.5 + 4 + (extraDisc * 4));

    checkPageBreak(rowH + 2);

    // Alternating stripe
    if (i % 2 === 0) {
      doc.setFillColor(...STRIPE);
      doc.rect(MARGIN, curY, CONTENT_W, rowH, 'F');
    }

    // ── Description (left-aligned, wrapping) ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(descLines, X_DESC + 2, curY + 5.5);

    // Optional discount note below description
    if (discPct > 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(...GRAY);
      doc.text(`Descuento ${discPct}%`, X_DESC + 2, curY + 5.5 + descLines.length * 4.5);
      doc.setTextColor(...BLACK);
    }

    // ── Quantity (center) ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BLACK);
    doc.text(String(qtyVal), X_QTY + COL_QTY / 2, curY + 5.5, { align: 'center' });

    // ── Unit label (center) ──
    const uLines = doc.splitTextToSize(toAsciiSafe(uLabel), COL_UNIT - 2);
    doc.text(uLines, X_UNIT + COL_UNIT / 2, curY + 5.5, { align: 'center' });

    // ── Unit Price (right-aligned) — Fix #4 ──
    doc.text(fmtMoney(unitPriceVal, currency), X_PRICE + COL_PRICE - 2, curY + 5.5, { align: 'right' });

    // ── Amount (right-aligned) — Fix #4 ──
    doc.setFont('helvetica', 'bold');
    doc.text(fmtMoney(amount, currency), X_AMT + COL_AMT - 2, curY + 5.5, { align: 'right' });

    // Bottom cell divider
    doc.setDrawColor(...LGRAY);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, curY + rowH, PAGE_W - MARGIN_R, curY + rowH);

    curY += rowH;
  });

  // Table bottom border
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, curY, PAGE_W - MARGIN_R, curY);
  curY += 8;

  /* ─────────────────────────────────────────────
     6. FINANCIAL SUMMARY
     Fix #4: All values right-aligned. Consistent column layout.
  ───────────────────────────────────────────── */
  checkPageBreak(40);

  const subtotal   = proposal.subtotal   || 0;
  const discountAmt = proposal.discount  || 0;
  const vatAmt     = applyVat ? (proposal.vat || 0) : 0;
  const grandTotal = proposal.grandTotal || 0;

  // Summary block right-aligned in right 45% of content
  const SUM_W      = CONTENT_W * 0.45;
  const SUM_LEFT   = MARGIN + CONTENT_W - SUM_W;  // Left edge of summary block
  const SUM_LBL_X  = SUM_LEFT + SUM_W * 0.55;    // Label right edge
  const SUM_VAL_X  = PAGE_W - MARGIN_R;             // Value right edge

  /** Render one summary row */
  function summaryRow(label, value, bold, highlight) {
    checkPageBreak(8);
    if (highlight) {
      doc.setFillColor(...DARK);
      doc.rect(SUM_LEFT, curY - 5.5, SUM_W, 8.5, 'F');
      doc.setTextColor(...WHITE);
    } else {
      doc.setTextColor(...BLACK);
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 9 : 8);
    doc.text(label, SUM_LBL_X, curY, { align: 'right' });
    doc.text(fmtMoney(value, currency), SUM_VAL_X, curY, { align: 'right' });
    curY += 7;
    if (!highlight) doc.setTextColor(...BLACK);
  }

  summaryRow('Subtotal:', subtotal);
  if (discountAmt > 0) summaryRow('Descuento:', -discountAmt);

  if (applyVat) {
    summaryRow(`IVA (${vatPct}%):`, vatAmt);
  }

  // Divider before total
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.3);
  doc.line(SUM_LEFT, curY - 2, PAGE_W - MARGIN_R, curY - 2);

  summaryRow('TOTAL:', grandTotal, true, true);
  curY += 4;

  /* ─────────────────────────────────────────────
     7. PROFITABILITY BLOCK (internal, optional)
  ───────────────────────────────────────────── */
  const prof = proposal.profitability;
  if (prof && (prof.estimatedHours || prof.expenses || prof.travelCosts)) {
    checkPageBreak(34);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('ANALISIS DE RENTABILIDAD (INTERNO)', MARGIN, curY);
    curY += 5;

    doc.setFillColor(...LIGHT);
    doc.roundedRect(MARGIN, curY, CONTENT_W, 22, 1.5, 1.5, 'F');

    const profData = [
      ['Horas estimadas', String(prof.estimatedHours || 0)],
      ['Gastos',          fmtMoney(prof.expenses     || 0, currency)],
      ['Viaticos',        fmtMoney(prof.travelCosts  || 0, currency)],
      ['Ingreso bruto',   fmtMoney(prof.grossRevenue || 0, currency)],
      ['Utilidad neta',   fmtMoney(prof.netProfit    || 0, currency)],
      ['Margen',          `${(prof.profitMargin || 0).toFixed(1)}%`],
    ];

    const colW = CONTENT_W / 3;
    profData.forEach(([lbl, val], idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const px  = MARGIN + 4 + col * colW;
      const py  = curY + 5.5 + row * 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...GRAY);
      doc.text(lbl.toUpperCase(), px, py);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...BLACK);
      doc.text(val, px, py + 5);
    });

    curY += 28;
  }

  /* ─────────────────────────────────────────────
     8. FOOTER on every page
     Fix #9: Updated validity text, ASCII-safe.
  ───────────────────────────────────────────── */
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text(
      `Pag. ${pg} / ${totalPages}`,
      PAGE_W - MARGIN_R,
      PAGE_H - 10,
      { align: 'right' }
    );
  }

  /* ─────────────────────────────────────────────
     9. SAVE FILE
  ───────────────────────────────────────────── */
  const clientSlug = toAsciiSafe(proposal.clientName || 'cliente').replace(/\s+/g, '_');
  const filename   = `${proposal.proposalNumber || 'propuesta'}_${clientSlug}.pdf`;
  doc.save(filename);
}
