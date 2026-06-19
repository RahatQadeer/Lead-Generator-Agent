/** Design tokens — light + dark via CSS variables in globals.css */

const focusRing =
  "focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent-600)_25%,transparent)] focus:border-[var(--color-border)]";

export const inputClassName =
  `w-full min-h-[44px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] shadow-[var(--shadow-card)] placeholder:font-normal placeholder:text-[var(--color-ink-muted)] transition-[border-color,box-shadow] ${focusRing} disabled:cursor-not-allowed disabled:bg-[var(--color-surface-subtle)] disabled:text-[var(--color-ink-muted)]`;

export const selectClassName =
  `w-full min-h-[44px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-[border-color,box-shadow] ${focusRing} disabled:cursor-not-allowed disabled:bg-[var(--color-surface-subtle)] disabled:opacity-60`;

export const cardClassName =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

export const dashboardCardClassName =
  "rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

export const dashboardCardIconClassName =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--color-accent-600)_30%,transparent)] bg-[var(--color-surface-subtle)] text-[var(--color-accent-600)] shadow-[var(--shadow-card)]";

export const cardPaddingClassName = "p-6 sm:p-8";

export const dashboardCardPaddingClassName = "p-5 sm:p-6";

export const dashboardStatCardClassName =
  "relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

export const sequencedItemClassName =
  "block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] hover:shadow-[var(--shadow-elevated)]";

export const miniMetricClassName =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4";

export const nestedCardClassName =
  "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)]";

export const nestedCardPaddingClassName = "p-4 sm:p-5";

export const pageSurfaceClassName =
  "min-h-screen bg-[var(--color-surface-muted)] text-[var(--color-ink)]";

export const sidebarClassName =
  "flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]";

export const headerClassName =
  "sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] backdrop-blur-md";

export const toolbarClassName =
  "flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between";

export const toolbarGroupClassName =
  "flex flex-wrap items-center gap-2 sm:gap-3";

export const btnPrimaryClassName =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--color-btn-primary-text)] shadow-[var(--shadow-card)] transition-all hover:bg-[var(--color-btn-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent-600)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondaryClassName =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--color-btn-secondary-border)] bg-[var(--color-btn-secondary-bg)] px-5 py-2.5 text-sm font-medium text-[var(--color-btn-secondary-text)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--color-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent-600)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const btnSmPrimaryClassName =
  "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-4 py-2 text-sm font-medium text-[var(--color-btn-primary-text)] shadow-sm transition-all hover:bg-[var(--color-btn-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent-600)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const btnSmSecondaryClassName =
  "inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full border border-[var(--color-btn-secondary-border)] bg-[var(--color-btn-secondary-bg)] px-4 py-2 text-sm font-medium text-[var(--color-btn-secondary-text)] shadow-sm transition-colors hover:bg-[var(--color-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent-600)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhostClassName =
  "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--color-ink-secondary)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50";

export const btnIconClassName =
  "inline-flex items-center justify-center rounded-xl p-2 text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink-secondary)] disabled:cursor-not-allowed disabled:opacity-50";

export const btnIconSmPrimaryClassName =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-btn-primary-bg)] text-[var(--color-btn-primary-text)] shadow-sm transition-all hover:bg-[var(--color-btn-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent-600)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const btnIconSmSecondaryClassName =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-btn-secondary-border)] bg-[var(--color-btn-secondary-bg)] text-[var(--color-btn-secondary-text)] shadow-sm transition-colors hover:bg-[var(--color-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-accent-600)_20%,transparent)]";

export const pillActiveClassName =
  "inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-accent-600)_35%,transparent)] bg-[var(--color-accent-50)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-accent-text)] shadow-sm";

export const pillInactiveClassName =
  "inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-secondary)] transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-ink)]";

export const navLinkActiveClassName =
  "flex items-center gap-3 rounded-xl bg-[var(--color-accent-50)] px-3.5 py-2.5 text-sm font-semibold text-[var(--color-ink)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent-600)_25%,transparent)]";

export const navLinkInactiveClassName =
  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink-secondary)]";

export const iconTileClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent-50)] text-[var(--color-accent-600)]";

export const iconTileSmClassName =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-50)] text-[var(--color-accent-600)]";

export const labelClassName =
  "block text-[0.8125rem] font-medium tracking-[-0.01em] text-[var(--color-ink-secondary)]";

export const hintClassName =
  "text-xs leading-relaxed tracking-[-0.005em] text-[var(--color-ink-muted)]";

export const errorClassName = "text-xs font-medium text-[var(--color-danger-text)]";

export const headingPageClassName =
  "text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--color-ink)] sm:text-[2rem]";

export const headingSectionClassName =
  "text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-[var(--color-ink)]";

export const headingSubsectionClassName =
  "text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-muted)]";

export const textSecondaryClassName =
  "text-[0.9375rem] leading-[1.65] tracking-[-0.01em] text-[var(--color-ink-secondary)]";

export const textPrimaryClassName =
  "text-sm font-medium tracking-[-0.01em] text-[var(--color-ink)]";

export const textEyebrowClassName =
  "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]";

export const linkClassName =
  "inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)] underline decoration-[var(--color-border)] underline-offset-4 transition-colors hover:decoration-[var(--color-ink)]";

export const alertErrorClassName =
  "rounded-2xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--color-danger-text)]";

export const alertSuccessClassName =
  "rounded-2xl border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--color-success-text)]";

export const alertWarningClassName =
  "rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--color-warning-text)]";

export const alertInfoClassName =
  "rounded-2xl border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--color-info-text)]";

export const dropdownPanelClassName =
  "absolute z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 shadow-[var(--shadow-elevated)]";

export const profilePopoverClassName =
  "absolute right-0 top-[calc(100%+10px)] z-50 w-[min(100vw-2rem,18rem)] origin-top-right overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)]";

export const tagDefaultClassName =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--color-accent-600)_25%,transparent)] bg-[var(--color-accent-50)] px-2.5 py-1 text-xs font-medium text-[var(--color-accent-text)] break-words";

export const tagExcludeClassName =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-2.5 py-1 text-xs font-medium text-[var(--color-danger-text)] break-words";

export const metricTileClassName =
  "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]";

export const listItemClassName =
  "flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-card)] transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] hover:shadow-[var(--shadow-elevated)]";

export const inCardListRowClassName =
  "group flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-4 transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] hover:shadow-sm border-l-[3px]";

export const tableWrapperClassName =
  "overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]";

export const tableClassName = "w-full min-w-[640px] text-left text-sm";

export const tableHeadClassName =
  "border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]";

export const tableHeadCellClassName = "px-5 py-3.5 font-semibold";

export const tableRowClassName =
  "border-b border-[var(--color-border-subtle)] transition-colors last:border-0 hover:bg-[var(--color-surface-subtle)]";

export const tableCellClassName =
  "px-5 py-4 align-middle text-[0.9375rem] tracking-[-0.01em] text-[var(--color-ink-secondary)]";

export const outreachStepClassName =
  "mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--color-accent-600)_20%,transparent)] bg-[var(--color-accent-50)] p-4 shadow-[var(--shadow-card)]";

export const settingsCardClassName = `${cardClassName} ${cardPaddingClassName}`;

export const previewResultItemClassName =
  "flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)]";

export const providerBadgeClassName =
  "inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-ink-muted)] shadow-sm";
