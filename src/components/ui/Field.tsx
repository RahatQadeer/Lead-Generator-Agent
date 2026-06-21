// import {
//   errorClassName,
//   hintClassName,
//   inputClassName,
//   labelClassName,
//   selectClassName,
// } from "@/lib/ui/styles";

// interface FieldProps {
//   label: string;a
//   htmlFor: string;
//   error?: string;
//   hint?: string;
//   required?: boolean;
//   optional?: boolean;
//   children: React.ReactNode;
// }

// export function Field({
//   label,
//   htmlFor,
//   error,
//   hint,
//   required = false,
//   optional = false,
//   children,
// }: FieldProps) {
//   return (
//     <div className="space-y-2">
//       <label htmlFor={htmlFor} className={labelClassName}>
//         {label}
//         {required && (
//           <span className="ml-0.5 text-red-500" aria-hidden="true">
//           <span className="ml-0.5 text-red-400" aria-hidden="true">
//             *
//           </span>
//         )}
//         {optional && (
//           <span className="ml-1.5 text-xs font-normal text-gray-400">
//           <span className="ml-1.5 text-xs font-normal text-slate-500">
//             (optional)
//           </span>
//         )}
//       </label>
//       {children}
//       {hint && !error && <p className={hintClassName}>{hint}</p>}
//       {error && (
//         <p className={errorClassName} role="alert">
//           {error}
//         </p>
//       )}
//     </div>
//   );
// }

// export { inputClassName, selectClassName };


import {
  errorClassName,
  hintClassName,
  inputClassName,
  labelClassName,
  selectClassName,
} from "@/lib/ui/styles";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  optional = false,
  children,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className={labelClassName}
      >
        {label}

        {required && (
          <span
            className="ml-0.5 text-[var(--color-danger-text)]"
            aria-hidden="true"
          >
            *
          </span>
        )}

        {optional && (
          <span className="ml-1.5 text-xs font-normal text-[var(--color-ink-muted)]">
            (optional)
          </span>
        )}
      </label>

      {children}

      {hint && !error && (
        <p className={hintClassName}>
          {hint}
        </p>
      )}

      {error && (
        <p
          className={errorClassName}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export { inputClassName, selectClassName };
