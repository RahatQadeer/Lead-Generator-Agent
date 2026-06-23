"use client";

import { ChevronRight } from "lucide-react";
import { previewResultItemClassName } from "@/lib/ui/styles";

interface PreviewResultRowProps {
  onClick: () => void;
  children: React.ReactNode;
}

export function PreviewResultRow({ onClick, children }: PreviewResultRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`${previewResultItemClassName} group w-full cursor-pointer text-left transition-[border-color,box-shadow] hover:border-violet-200 hover:shadow-md`}
      >
        {children}
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400" />
      </button>
    </li>
  );
}
