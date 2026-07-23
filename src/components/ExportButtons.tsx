import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import type { EntryWithProduct } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getProductAndSubProduct } from "@/lib/product-mapping";

type SubProductLite = { id: string; product_id: string; name: string; code: string | null };

const resolveNames = (e: EntryWithProduct, subProducts: SubProductLite[]) => {
  const sub = subProducts.find((s) => s.id === e.product_id);
  if (sub) {
    return {
      productName: "—",
      subName: sub.name,
      code: sub.code ?? e.product?.code ?? "",
      parentId: sub.product_id,
    };
  }
  return {
    productName: e.product?.name ?? "—",
    subName: "",
    code: e.product?.code ?? "",
    parentId: null as string | null,
  };
};

export const ExportButtons = ({
  entries,
  subProducts = [],
  productsById = {},
}: {
  entries: EntryWithProduct[];
  subProducts?: SubProductLite[];
  productsById?: Record<string, { name: string; code?: string | null }>;
}) => {
  const buildRows = () =>
    entries.map((e) => {
      const r = resolveNames(e, subProducts);
      const parentName = r.parentId ? (productsById[r.parentId]?.name ?? "—") : r.productName;
      const { product, subProduct } = getProductAndSubProduct(parentName, r.subName || null);
      const mp = (e as any).manpower ?? 0;
      const perWorker = mp > 0 ? Math.round((e.completed_qty / mp) * 10) / 10 : 0;
      return {
        date: e.entry_date,
        product,
        sub: subProduct === "—" ? "" : subProduct,
        code: r.code,
        target: e.target_qty,
        completed: e.completed_qty,
        manpower: mp,
        perWorker: mp > 0 ? perWorker : "",
      };
    });

  const exportPdf = () => {
    if (!entries.length) return toast.error("No data to export");
    try {
      const doc = new jsPDF();
      const data = buildRows();
      const fmtPdfDate = (d: string) => {
        if (!d) return "—";
        try {
          const dt = new Date(d);
          if (isNaN(dt.getTime())) return "—";
          const day = String(dt.getDate()).padStart(2, "0");
          const mon = dt.toLocaleString("en-US", { month: "short" });
          return `${day}-${mon}-${dt.getFullYear()}`;
        } catch {
          return "—";
        }
      };
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("BIGFOX PRODUCTION", pageWidth / 2, 15, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text("Production Report", pageWidth / 2, 22, { align: "center" });
      doc.setFontSize(10);
      doc.text(`Date: ${fmtPdfDate(new Date().toISOString().slice(0, 10))}`, pageWidth / 2, 28, {
        align: "center",
      });
      autoTable(doc, {
        startY: 34,
        head: [["Date", "Product", "Sub Product", "Target", "Completed", "Manpower"]],
        body: data.map((item) => [
          fmtPdfDate(item.date),
          item.product,
          item.sub || "-",
          item.target,
          item.completed,
          item.manpower,
        ]),
      });
      doc.save("production-report.pdf");
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to download PDF");
    }
  };

  const exportXlsx = () => {
    if (!entries.length) return toast.error("No data to export");
    try {
      const data = buildRows().map((r) => ({
        Date: r.date,
        "Product Name": r.product,
        "Sub Product": r.sub,
        "Product Code": r.code,
        Target: r.target,
        Completed: r.completed,
        Manpower: r.manpower,
        "Per Worker": r.perWorker,
      }));
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = today.toLocaleString("en-US", { month: "short" });
      const dateStr = `${dd}-${mm}-${today.getFullYear()}`;
      const headerAoa = [["BIGFOX PRODUCTION"], ["Production Report"], [`Date: ${dateStr}`], []];
      const worksheet = XLSX.utils.aoa_to_sheet(headerAoa);
      XLSX.utils.sheet_add_json(worksheet, data, { origin: "A5" });
      const colCount = 8;
      worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
      ];
      for (let i = 0; i < 3; i++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: i, c: 0 })];
        if (cell) {
          cell.s = {
            font: { bold: i === 0, sz: i === 0 ? 16 : i === 1 ? 12 : 10 },
            alignment: { horizontal: "center" },
          };
        }
      }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
      XLSX.writeFile(workbook, "production-report.xlsx");
      toast.success("Excel downloaded");
    } catch (err) {
      console.error("Excel export failed:", err);
      toast.error("Failed to download Excel");
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportPdf}>
        <Download className="h-3.5 w-3.5 mr-1.5" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={exportXlsx}>
        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
        Excel
      </Button>
    </div>
  );
};
