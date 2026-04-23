import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@football/utils";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export function Button({ className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

