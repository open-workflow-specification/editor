/*
 * Copyright 2021-Present The Open Workflow Specification Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Styled native `<select>` element consistent with the project's Input component.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "dec:h-7 dec:w-full dec:min-w-0 dec:rounded-md dec:border dec:border-input dec:bg-transparent dec:px-2 dec:py-0.5 dec:text-xs dec:shadow-xs dec:transition-[color,box-shadow] dec:outline-none",
        "dec:disabled:pointer-events-none dec:disabled:cursor-not-allowed dec:disabled:opacity-50 dec:dark:bg-input/30",
        "dec:focus-visible:border-ring dec:focus-visible:ring-[3px] dec:focus-visible:ring-ring/50",
        "dec:aria-invalid:border-destructive dec:aria-invalid:ring-destructive/20 dec:dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
