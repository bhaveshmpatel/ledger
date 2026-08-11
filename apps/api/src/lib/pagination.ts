import type { PaginatedResult } from "@erp/types";

export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export function offsetFor(page: number, limit: number) {
  return (page - 1) * limit;
}
