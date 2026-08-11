import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-line bg-white px-4 py-3 sm:px-6">
      <div className="hidden sm:block">
        <p className="text-sm text-muted">
          Page <span className="font-medium text-ink">{page}</span> of{" "}
          <span className="font-medium text-ink">{totalPages}</span>
        </p>
      </div>
      <div className="flex flex-1 justify-between sm:justify-end gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="focus-ring flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1 text-sm font-medium hover:bg-ink/5 disabled:opacity-50"
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="focus-ring flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1 text-sm font-medium hover:bg-ink/5 disabled:opacity-50"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
