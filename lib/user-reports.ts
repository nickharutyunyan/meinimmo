/** Page size for account report history. The account list must not be unbounded. */
export const USER_REPORT_PAGE_SIZE = 50;
const MAX_REPORT_PAGE = 200;

export function userReportWindow(pageParam: string | null | undefined) {
  const parsed = Number(pageParam);
  const page = Number.isInteger(parsed) && parsed >= 1 ? Math.min(parsed, MAX_REPORT_PAGE) : 1;
  return { page, limit: USER_REPORT_PAGE_SIZE, offset: (page - 1) * USER_REPORT_PAGE_SIZE };
}
