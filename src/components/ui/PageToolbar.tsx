import { toolbarClassName, toolbarGroupClassName } from "@/lib/ui/styles";

interface PageToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageToolbar({
  left,
  right,
  children,
  className = "",
}: PageToolbarProps) {
  if (children) {
    return (
      <div className={`${toolbarClassName} ${className}`.trim()}>{children}</div>
    );
  }

  return (
    <div className={`${toolbarClassName} ${className}`.trim()}>
      {left && <div className={`min-w-0 flex-1 ${toolbarGroupClassName}`}>{left}</div>}
      {right && <div className={toolbarGroupClassName}>{right}</div>}
    </div>
  );
}
