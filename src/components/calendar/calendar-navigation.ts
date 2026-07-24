type CalendarNavigationState = {
  pathname: string;
  search: string;
  hash: string;
  date: string;
};

export function buildCalendarNavigationHref({
  pathname,
  search,
  hash,
  date,
}: CalendarNavigationState): string {
  const params = new URLSearchParams(search);
  params.set("month", date.slice(0, 7));
  params.set("date", date);
  return `${pathname}?${params.toString()}${hash}`;
}
