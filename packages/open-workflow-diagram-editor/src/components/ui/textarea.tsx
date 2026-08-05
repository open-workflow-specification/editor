import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "dec:flex dec:field-sizing-content dec:min-h-16 dec:w-full dec:rounded-md dec:border dec:border-slate-300 dec:bg-white dec:px-3 dec:py-2 dec:text-base dec:text-slate-900 dec:placeholder:text-slate-400 dec:shadow-xs dec:transition-[border-color,box-shadow] dec:outline-none dec:hover:border-slate-400 dec:focus-visible:border-blue-500 dec:focus-visible:ring-[3px] dec:focus-visible:ring-blue-500/20 dec:disabled:cursor-not-allowed dec:disabled:opacity-50 dec:aria-invalid:border-red-500 dec:aria-invalid:ring-[3px] dec:aria-invalid:ring-red-500/20 dec:md:text-sm dec:dark:border-slate-600 dec:dark:bg-[#1f2937] dec:dark:text-slate-100 dec:dark:placeholder:text-slate-400 dec:dark:hover:border-slate-500 dec:dark:focus-visible:border-blue-400 dec:dark:focus-visible:ring-blue-400/20",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
