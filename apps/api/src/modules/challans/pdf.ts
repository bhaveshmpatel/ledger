import PDFDocument from "pdfkit";

// ── Modern Palette ─────────────────────────────────────────────────────────
const COLORS = {
  ink: "#09090b",       // Zinc 950
  muted: "#71717a",     // Zinc 500
  line: "#e4e4e7",      // Zinc 200
  accent: "#18181b",    // Zinc 900 for modern monochrome headers
  bg: "#ffffff",
  surface: "#f4f4f5",   // Zinc 100 for table headers
  success: "#16a34a",
  danger: "#dc2626",
  warning: "#d97706",
};

interface ChallanItem {
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: string;
}

interface ChallanPdfData {
  challanNumber: string;
  status: string;
  createdAt: string | Date;
  customer: {
    name: string;
    businessName: string;
    address: string;
    mobile: string;
    gstNumber?: string | null;
  };
  items: ChallanItem[];
}

const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 595.28 - (PAGE_MARGIN * 2); // A4 width is 595.28

const COL = {
  sku:    { x: PAGE_MARGIN,        w: 90 },
  name:   { x: PAGE_MARGIN + 100,  w: 180 },
  qty:    { x: PAGE_MARGIN + 290,  w: 60 },
  rate:   { x: PAGE_MARGIN + 360,  w: 65 },
  amount: { x: PAGE_MARGIN + 435,  w: 60 },
};

export async function renderChallanPdf(challan: ChallanPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
      info: {
        Title: `Challan - ${challan.challanNumber}`,
        Author: "ERP Platform",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const grandTotal = challan.items.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice), 0);
    const dateStr = new Date(challan.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });

    // --- Header Section ---
    let y = PAGE_MARGIN;

    // Company / Brand
    doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.ink).text("ERP INC.", PAGE_MARGIN, y);
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text("123 Business Avenue, Tech Park", PAGE_MARGIN, y + 25);
    doc.text("Gujarat, India 380015", PAGE_MARGIN, y + 37);
    doc.text("contact@erpinc.test  |  +91 98765 43210", PAGE_MARGIN, y + 49);

    // Document Title & Meta
    doc.font("Helvetica-Bold").fontSize(24).fillColor(COLORS.ink).text("CHALLAN", PAGE_MARGIN, y, { align: "right" });
    doc.font("Helvetica-Bold").fontSize(10).text(challan.challanNumber, PAGE_MARGIN, y + 28, { align: "right" });
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text(dateStr, PAGE_MARGIN, y + 42, { align: "right" });

    // Status Badge
    const statusY = y + 60;
    const badgeColor = challan.status.toLowerCase() === "confirmed" ? COLORS.success : challan.status.toLowerCase() === "cancelled" ? COLORS.danger : COLORS.warning;
    doc.roundedRect(595.28 - PAGE_MARGIN - 70, statusY, 70, 20, 4).fill(badgeColor);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff").text(challan.status.toUpperCase(), 595.28 - PAGE_MARGIN - 70, statusY + 6, { width: 70, align: "center" });

    y += 100;

    // --- Divider ---
    doc.moveTo(PAGE_MARGIN, y).lineTo(595.28 - PAGE_MARGIN, y).strokeColor(COLORS.line).lineWidth(1).stroke();
    y += 20;

    // --- Bill To Section ---
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("BILLED TO", PAGE_MARGIN, y);
    y += 18;

    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.ink).text(challan.customer.businessName, PAGE_MARGIN, y);
    y += 16;
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text(challan.customer.name, PAGE_MARGIN, y);
    y += 14;
    doc.fontSize(10).text(challan.customer.address, PAGE_MARGIN, y, { width: 250 });
    
    y += doc.heightOfString(challan.customer.address, { width: 250 }) + 4;
    doc.fontSize(10).text(`Mobile: ${challan.customer.mobile}`, PAGE_MARGIN, y);
    
    if (challan.customer.gstNumber) {
      y += 14;
      doc.fontSize(10).text(`GSTIN: ${challan.customer.gstNumber}`, PAGE_MARGIN, y);
    }

    y += 40;

    // --- Table Header ---
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 26, 4).fill(COLORS.surface);
    const hY = y + 8;
    
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink);
    doc.text("SKU", COL.sku.x + 10, hY, { width: COL.sku.w - 10 });
    doc.text("DESCRIPTION", COL.name.x, hY, { width: COL.name.w });
    doc.text("QTY", COL.qty.x, hY, { width: COL.qty.w, align: "right" });
    doc.text("RATE", COL.rate.x, hY, { width: COL.rate.w, align: "right" });
    doc.text("AMOUNT", COL.amount.x, hY, { width: COL.amount.w - 10, align: "right" });

    y += 36;

    // --- Table Rows ---
    challan.items.forEach((item, idx) => {
      // Add page break if getting too close to bottom
      if (y > 700) {
        doc.addPage();
        y = PAGE_MARGIN;
      }

      const rowH = 24;
      const rY = y + 6;

      doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted);
      doc.text(item.productSku, COL.sku.x + 10, rY, { width: COL.sku.w - 10 });

      doc.font("Helvetica-Bold").fillColor(COLORS.ink);
      doc.text(item.productName, COL.name.x, rY, { width: COL.name.w });

      doc.font("Helvetica").fillColor(COLORS.muted);
      doc.text(String(item.quantity), COL.qty.x, rY, { width: COL.qty.w, align: "right" });
      doc.text(`₹${Number(item.unitPrice).toFixed(2)}`, COL.rate.x, rY, { width: COL.rate.w, align: "right" });

      doc.font("Helvetica").fillColor(COLORS.ink);
      const lineTotal = item.quantity * Number(item.unitPrice);
      doc.text(`₹${lineTotal.toFixed(2)}`, COL.amount.x, rY, { width: COL.amount.w - 10, align: "right" });

      doc.moveTo(PAGE_MARGIN, y + rowH).lineTo(595.28 - PAGE_MARGIN, y + rowH).strokeColor(COLORS.line).lineWidth(0.5).stroke();
      y += rowH;
    });

    y += 20;

    // --- Summary & Totals ---
    if (y > 650) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    const summaryY = y;
    
    // Left side summary
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted);
    doc.text(`Total Items: ${challan.items.length}`, PAGE_MARGIN, summaryY);
    doc.text(`Total Quantity: ${challan.items.reduce((s, i) => s + i.quantity, 0)} Units`, PAGE_MARGIN, summaryY + 14);

    // Right side totals box
    const totalBoxW = 220;
    const totalBoxX = 595.28 - PAGE_MARGIN - totalBoxW;
    
    doc.roundedRect(totalBoxX, summaryY, totalBoxW, 40, 6).fill(COLORS.ink);
    
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff");
    doc.text("GRAND TOTAL", totalBoxX + 15, summaryY + 14);
    
    doc.fontSize(14);
    doc.text(`₹${grandTotal.toFixed(2)}`, totalBoxX, summaryY + 12, { width: totalBoxW - 15, align: "right" });

    y = summaryY + 80;

    // --- Terms & Signatures ---
    if (y > 700) {
      doc.addPage();
      y = PAGE_MARGIN;
    }

    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text("Terms & Conditions", PAGE_MARGIN, y);
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted);
    doc.text("1. All goods returned must be in original condition.", PAGE_MARGIN, y + 14);
    doc.text("2. Payment is due within 30 days from the date of challan.", PAGE_MARGIN, y + 26);
    doc.text("3. Subject to local jurisdiction.", PAGE_MARGIN, y + 38);

    doc.moveTo(595.28 - PAGE_MARGIN - 150, y + 40).lineTo(595.28 - PAGE_MARGIN, y + 40).strokeColor(COLORS.ink).lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink).text("Authorized Signature", 595.28 - PAGE_MARGIN - 150, y + 48, { width: 150, align: "center" });

    // --- Footer ---
    const footerY = 841.89 - PAGE_MARGIN - 10;
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text("Generated by ERP Platform", PAGE_MARGIN, footerY, { align: "center", width: CONTENT_WIDTH });

    doc.end();
  });
}
