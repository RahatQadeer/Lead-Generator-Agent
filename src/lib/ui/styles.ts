/** Premium soft-light SaaS design tokens (charcoal + pastel accents) */

const focusRing =
  "focus:outline-none focus:ring-2 focus:ring-gray-900/8 focus:border-gray-400";

export const inputClassName =
  `w-full min-h-[44px] rounded-2xl border border-gray-200/90 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] placeholder:font-normal placeholder:text-gray-400 transition-[border-color,box-shadow] ${focusRing} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`;

export const selectClassName =
  `w-full min-h-[44px] rounded-2xl border border-gray-200/90 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] ${focusRing} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60`;

export const cardClassName =
  "rounded-2xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)]";

/** Floating bento-style dashboard cards */
export const dashboardCardClassName =
  "rounded-3xl border border-gray-100/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.06)]";

export const dashboardCardIconClassName =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-200/90 bg-white text-violet-600 shadow-[0_1px_2px_rgba(139,92,246,0.1)]";

export const cardPaddingClassName = "p-6 sm:p-8";

export const dashboardCardPaddingClassName = "p-5 sm:p-6";

/** Static KPI / metric tile on dashboard — display only, no hover motion */
export const dashboardStatCardClassName =
  "relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

/** Clickable dashboard row (quick links, activity, onboarding) */
export const sequencedItemClassName =
  "block rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-200 hover:border-gray-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]";

/** Nested metric tile inside a section card */
export const miniMetricClassName =
  "rounded-2xl border border-gray-100 bg-gray-50/70 p-4";

export const nestedCardClassName =
  "rounded-xl border border-gray-100 bg-gray-50/80";

export const nestedCardPaddingClassName = "p-4 sm:p-5";

export const pageSurfaceClassName = "min-h-screen bg-[#f4f4f5]";

export const sidebarClassName =
  "flex flex-col border-r border-gray-200/80 bg-white";

export const headerClassName =
  "sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur-md";

export const toolbarClassName =
  "flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between";

export const toolbarGroupClassName =
  "flex flex-wrap items-center gap-2 sm:gap-3";

/* Primary = charcoal (Sundays-style) */
export const btnPrimaryClassName =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-all hover:bg-gray-800 hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondaryClassName =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSmPrimaryClassName =
  "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSmSecondaryClassName =
  "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhostClassName =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50";

export const btnIconClassName =
  "inline-flex items-center justify-center rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50";

export const btnIconSmPrimaryClassName =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white shadow-sm transition-all hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-50";

export const btnIconSmSecondaryClassName =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200";

export const pillActiveClassName =
  "inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-gradient-to-r from-violet-50 to-purple-50 px-3.5 py-1.5 text-xs font-semibold text-violet-900 shadow-sm";

export const pillInactiveClassName =
  "inline-flex items-center gap-2 rounded-full border border-gray-200/90 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800";

export const navLinkActiveClassName =
  "flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-50 via-purple-50/80 to-violet-50 px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)]";

export const navLinkInactiveClassName =
  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800";

export const iconTileClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-700";

export const iconTileSmClassName =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-700";

export const labelClassName =
  "block text-[0.8125rem] font-medium tracking-[-0.01em] text-gray-600";

export const hintClassName =
  "text-xs leading-relaxed tracking-[-0.005em] text-gray-400";

export const errorClassName = "text-xs font-medium text-red-600";

export const headingPageClassName =
  "text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-gray-950 sm:text-[2rem]";

export const headingSectionClassName =
  "text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-gray-900";

export const headingSubsectionClassName =
  "text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-gray-400";

export const textSecondaryClassName =
  "text-[0.9375rem] leading-[1.65] tracking-[-0.01em] text-gray-500";

export const textPrimaryClassName =
  "text-sm font-medium tracking-[-0.01em] text-gray-900";

export const textEyebrowClassName =
  "text-xs font-semibold uppercase tracking-[0.08em] text-gray-400";

export const linkClassName =
  "inline-flex items-center gap-1.5 text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 transition-colors hover:decoration-gray-900";

export const alertErrorClassName =
  "rounded-2xl border border-red-100 bg-red-50/80 px-4 py-3 text-sm leading-relaxed text-red-800";

export const alertSuccessClassName =
  "rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm leading-relaxed text-emerald-800";

export const alertWarningClassName =
  "rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-amber-900";

export const alertInfoClassName =
  "rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-3 text-sm leading-relaxed text-violet-900";

export const dropdownPanelClassName =
  "absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-gray-100 bg-white py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)]";

/** Account popover — fixed width, do not use combobox dropdown classes */
export const profilePopoverClassName =
  "absolute right-0 top-[calc(100%+10px)] z-50 w-[min(100vw-2rem,18rem)] origin-top-right overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]";

export const tagDefaultClassName =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 break-words";

export const tagExcludeClassName =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 break-words";

export const metricTileClassName =
  "rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

export const listItemClassName =
  "flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:border-gray-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]";

/** In-card list row with left accent bar */
export const inCardListRowClassName =
  "group flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/40 px-4 py-4 transition-all hover:border-gray-200 hover:bg-gray-50 hover:shadow-sm border-l-[3px]";

export const tableWrapperClassName =
  "overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)]";

export const tableClassName = "w-full min-w-[640px] text-left text-sm";

export const tableHeadClassName =
  "border-b border-gray-100 bg-gray-50/80 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-gray-400";

export const tableHeadCellClassName = "px-5 py-3.5 font-semibold";

export const tableRowClassName =
  "border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/60";

export const tableCellClassName =
  "px-5 py-4 align-middle text-[0.9375rem] tracking-[-0.01em] text-gray-700";

export const outreachStepClassName =
  "mt-4 rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50/50 to-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]";

export const settingsCardClassName = `${cardClassName} ${cardPaddingClassName}`;

export const previewResultItemClassName =
  "flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]";

export const providerBadgeClassName =
  "inline-flex items-center rounded-full border border-gray-200/90 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-500 shadow-sm";
