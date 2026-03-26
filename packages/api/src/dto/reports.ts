/**
 * ReportDTO — what the frontend receives for an AI report record.
 *
 * createdAt is an ISO-8601 string (Drizzle Date objects become strings over
 * the tRPC wire; making the contract explicit removes the need for coercion
 * on the client).
 */

export interface ReportDTO {
  id:          string;
  type:        string;
  title:       string;
  status:      "pending" | "completed" | "failed";
  content:     string | null;
  /** ISO-8601 string */
  createdAt:   string;
  portfolioId: string | null;
}

export function toReportDTO(r: {
  id:          string;
  type:        string;
  title:       string;
  status:      string;
  content:     string | null;
  createdAt:   Date | string;
  portfolioId: string | null;
}): ReportDTO {
  return {
    id:          r.id,
    type:        r.type,
    title:       r.title,
    status:      r.status as ReportDTO["status"],
    content:     r.content,
    createdAt:   r.createdAt instanceof Date
      ? r.createdAt.toISOString()
      : String(r.createdAt),
    portfolioId: r.portfolioId,
  };
}
