"use client";

interface SelectOption {
  value: string;
  label: string;
}

interface DiscoveryResultsToolbarProps {
  sortLabel?: string;
  sortValue: string;
  sortOptions: SelectOption[];
  onSortChange: (value: string) => void;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: SelectOption[];
  onFilterChange?: (value: string) => void;
  shownCount: number;
  totalCount: number;
  totalLoadedLabel?: string;
}

export function DiscoveryResultsToolbar({
  sortLabel = "Sort",
  sortValue,
  sortOptions,
  onSortChange,
  filterLabel = "Filter",
  filterValue,
  filterOptions,
  onFilterChange,
  shownCount,
  totalCount,
  totalLoadedLabel,
}: DiscoveryResultsToolbarProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="font-medium">{sortLabel}</span>
          <select
            value={sortValue}
            onChange={(event) => onSortChange(event.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {filterOptions && filterValue !== undefined && onFilterChange && (
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="font-medium">{filterLabel}</span>
            <select
              value={filterValue}
              onChange={(event) => onFilterChange(event.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Showing {shownCount} of {totalCount}
        {totalLoadedLabel ? ` · ${totalLoadedLabel}` : ""}
      </p>
    </div>
  );
}

interface LoadMoreButtonProps {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  loadingLabel?: string;
}

export function DiscoveryLoadMoreButton({
  onClick,
  loading = false,
  label = "Load more",
  loadingLabel = "Loading…",
}: LoadMoreButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
