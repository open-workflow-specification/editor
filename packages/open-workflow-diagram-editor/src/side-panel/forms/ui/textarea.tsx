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

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "dec:flex dec:field-sizing-content dec:min-h-[60px] dec:w-full dec:rounded-md dec:border dec:border-input dec:bg-transparent dec:px-2 dec:py-1.5 dec:text-xs dec:placeholder:text-muted-foreground dec:shadow-xs dec:transition-[border-color,box-shadow] dec:outline-none dec:hover:border-ring/50 dec:focus-visible:border-ring dec:focus-visible:ring-[3px] dec:focus-visible:ring-ring/50 dec:disabled:cursor-not-allowed dec:disabled:opacity-50 dec:aria-invalid:border-destructive dec:aria-invalid:ring-[3px] dec:aria-invalid:ring-destructive/20 dec:dark:bg-input/30 dec:form-textarea",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
