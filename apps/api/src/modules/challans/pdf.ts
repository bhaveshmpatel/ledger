import PDFDocument from "pdfkit";

// ── Palette matching the project design tokens ─────────────────────────────
const INK = "#12151B";
const MUTED = "#6B6A63";
const LINE = "#D8D3C7";
const ACCENT = "#2F3A8F";
const PAPER = "#FAF8F3";
const ALERT = "#C98A2C";

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

// Column x-positions and widths for the items table
const COL = {
  sku:    { x: 50,  w: 90  },
  name:   { x: 145, w: 185 },
  qty:    { x: 335, w: 55  },
  rate:   { x: 395, w: 75  },
  amount: { x: 475, w: 70  },
};
const TABLE_RIGHT = COL.amount.x + COL.amount.w; // 545

function statusColor(status: string) {
  switch (status.toLowerCase()) {
    case "confirmed": return "#16A34A";
    case "cancelled": return "#DC2626";
    default:          return ALERT;    // draft
  }
}

export async function renderChallanPdf(challan: ChallanPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
      info: {
        Title: `Sales Challan ${challan.challanNumber}`,
        Author: "ERP Operations Portal",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const grandTotal = challan.items.reduce(
      (sum, i) => sum + i.quantity * Number(i.unitPrice),
      0
    );

    // ── Background ──────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(PAPER);

    // ── Header bar ──────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 72).fill(INK);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#FFFFFF")
      .text("SALES CHALLAN", 50, 20);

    // Challan number in monospace-style box
    doc
      .fontSize(10)
      .fillColor("#FFFFFF")
      .font("Helvetica")
      .text(challan.challanNumber, 50, 47);

    // Date — right-aligned in header
    const dateStr = new Date(challan.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
    doc
      .fontSize(10)
      .fillColor("#FFFFFF")
      .font("Helvetica")
      .text(dateStr, 0, 28, { align: "right", width: doc.page.width - 50 });

    // Status badge — right-aligned below date
    const sc = statusColor(challan.status);
    const statusLabel = challan.status.toUpperCase();
    const badgeW = 80;
    const badgeX = doc.page.width - 50 - badgeW;
    doc.roundedRect(badgeX, 44, badgeW, 18, 4).fill(sc);
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text(statusLabel, badgeX, 49, { width: badgeW, align: "center" });

    // ── Bill To section ──────────────────────────────────────────────────────
    let y = 90;

    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(MUTED)
      .text("BILL TO", 50, y);

    y += 14;

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor(INK)
      .text(challan.customer.businessName, 50, y);

    y += 16;

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(INK)
      .text(challan.customer.name, 50, y);

    y += 13;

    doc
      .fontSize(9)
      .fillColor(MUTED)
      .text(challan.customer.address, 50, y, { width: 240 });

    // calculate text height for address (may wrap)
    const addrHeight = doc.heightOfString(challan.customer.address, { width: 240 });
    y += addrHeight + 4;

    doc
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Mobile: ${challan.customer.mobile}`, 50, y);

    if (challan.customer.gstNumber) {
      y += 13;
      doc
        .fontSize(9)
        .fillColor(MUTED)
        .text(`GSTIN: ${challan.customer.gstNumber}`, 50, y);
    }

    // ── Divider ──────────────────────────────────────────────────────────────
    y += 24;
    doc.moveTo(50, y).lineTo(TABLE_RIGHT, y).strokeColor(LINE).lineWidth(1).stroke();

    // ── Items table header ───────────────────────────────────────────────────
    y += 10;

    doc
      .rect(50, y, TABLE_RIGHT - 50, 22)
      .fill(ACCENT);

    const hY = y + 6;
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#FFFFFF");
    doc.text("SKU",     COL.sku.x,    hY, { width: COL.sku.w });
    doc.text("PRODUCT", COL.name.x,   hY, { width: COL.name.w });
    doc.text("QTY",     COL.qty.x,    hY, { width: COL.qty.w,    align: "right" });
    doc.text("RATE",    COL.rate.x,   hY, { width: COL.rate.w,   align: "right" });
    doc.text("AMOUNT",  COL.amount.x, hY, { width: COL.amount.w, align: "right" });

    y += 22;

    // ── Items rows ───────────────────────────────────────────────────────────
    challan.items.forEach((item, idx) => {
      const rowH = 22;
      const bg = idx % 2 === 0 ? "#FFFFFF" : "#F5F3EE";
      doc.rect(50, y, TABLE_RIGHT - 50, rowH).fill(bg);

      const rY = y + 6;

      doc.fontSize(8).font("Helvetica").fillColor(MUTED);
      doc.text(item.productSku, COL.sku.x, rY, { width: COL.sku.w });

      doc.fillColor(INK);
      doc.text(item.productName, COL.name.x, rY, { width: COL.name.w });

      doc.font("Helvetica").fillColor(MUTED);
      doc.text(String(item.quantity), COL.qty.x, rY, { width: COL.qty.w, align: "right" });

      doc.text(
        `₹${Number(item.unitPrice).toFixed(2)}`,
        COL.rate.x, rY,
        { width: COL.rate.w, align: "right" }
      );

      const lineTotal = item.quantity * Number(item.unitPrice);
      doc.font("Helvetica-Bold").fillColor(INK);
      doc.text(
        `₹${lineTotal.toFixed(2)}`,
        COL.amount.x, rY,
        { width: COL.amount.w, align: "right" }
      );

      // Row bottom border
      doc
        .moveTo(50, y + rowH)
        .lineTo(TABLE_RIGHT, y + rowH)
        .strokeColor(LINE)
        .lineWidth(0.5)
        .stroke();

      y += rowH;
    });

    // ── Grand total row ───────────────────────────────────────────────────────
    const totalRowH = 28;
    doc.rect(50, y, TABLE_RIGHT - 50, totalRowH).fill(INK);

    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text("GRAND TOTAL", 50, y + 8, { width: COL.rate.x + COL.rate.w - 50, align: "right" });

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#FFFFFF")
      .text(
        `₹${grandTotal.toFixed(2)}`,
        COL.amount.x, y + 7,
        { width: COL.amount.w, align: "right" }
      );

    y += totalRowH + 24;

    // ── Summary line ─────────────────────────────────────────────────────────
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(MUTED)
      .text(
        `${challan.items.length} line item${challan.items.length !== 1 ? "s" : ""} · ` +
        `${challan.items.reduce((s, i) => s + i.quantity, 0)} total units`,
        50, y
      );

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc
      .moveTo(50, footerY - 10)
      .lineTo(TABLE_RIGHT, footerY - 10)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(MUTED)
      .text("Generated by ERP Operations Portal", 50, footerY - 2);

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(MUTED)
      .text(
        new Date().toLocaleString("en-IN"),
        0, footerY - 2,
        { align: "right", width: doc.page.width - 50 }
      );

    doc.end();
  });
}
