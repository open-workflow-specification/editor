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
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "dec:peer dec:group/switch dec:inline-flex dec:shrink-0 dec:items-center dec:rounded-full dec:border dec:border-slate-300 dec:bg-slate-300 dec:shadow-xs dec:transition-all dec:outline-none dec:focus-visible:ring-[3px] dec:focus-visible:ring-blue-500/30 dec:disabled:cursor-not-allowed dec:disabled:opacity-50 dec:data-[size=default]:h-5 dec:data-[size=default]:w-9 dec:data-[size=sm]:h-4 dec:data-[size=sm]:w-7 dec:data-[state=checked]:border-blue-600 dec:data-[state=checked]:bg-blue-600 dec:dark:border-slate-600 dec:dark:bg-slate-700 dec:dark:data-[state=checked]:border-blue-500 dec:dark:data-[state=checked]:bg-blue-500",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "dec:pointer-events-none dec:block dec:rounded-full dec:bg-white dec:shadow-sm dec:ring-0 dec:transition-transform dec:group-data-[size=default]/switch:h-4 dec:group-data-[size=default]/switch:w-4 dec:group-data-[size=sm]/switch:h-3 dec:group-data-[size=sm]/switch:w-3 dec:data-[state=checked]:translate-x-4 dec:data-[state=unchecked]:translate-x-0 dec:dark:bg-white",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
