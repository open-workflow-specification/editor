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
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const [container, setContainer] = React.useState<HTMLElement>();
  React.useEffect(() => {
    setContainer(document.querySelector<HTMLElement>(".dec-root") ?? undefined);
  }, []);
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "dec:z-50 dec:w-fit dec:origin-(--radix-tooltip-content-transform-origin) dec:animate-in dec:rounded-sm dec:bg-tooltip-foreground dec:px-1 dec:py-1 dec:text-[9px] dec:text-balance dec:text-tooltip-background dec:fade-in-0 dec:zoom-in-95 dec:data-[side=bottom]:slide-in-from-top-2 dec:data-[side=left]:slide-in-from-right-2 dec:data-[side=right]:slide-in-from-left-2 dec:data-[side=top]:slide-in-from-bottom-2 dec:data-[state=closed]:animate-out dec:data-[state=closed]:fade-out-0 dec:data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="dec:z-50 dec:size-2.5 dec:translate-y-[calc(-50%_-_2px)] dec:rotate-45 dec:rounded-[2px] dec:bg-tooltip-foreground dec:fill-tooltip-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
