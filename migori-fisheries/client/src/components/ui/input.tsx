import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };
