import {
  btnGhostClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
} from "@/lib/ui/styles";

type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: btnPrimaryClassName,
  secondary: btnSecondaryClassName,
  ghost: btnGhostClassName,
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
