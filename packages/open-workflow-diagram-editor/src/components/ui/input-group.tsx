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
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "dec:group/input-group dec:relative dec:flex dec:w-full dec:items-center dec:rounded-md dec:border dec:border-input dec:shadow-xs dec:transition-[color,box-shadow] dec:outline-none dec:dark:bg-input/30",
        "dec:h-9 dec:min-w-0 dec:has-[>textarea]:h-auto",

        // Variants based on alignment.
        "dec:has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "dec:has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "dec:has-[>[data-align=block-start]]:h-auto dec:has-[>[data-align=block-start]]:flex-col dec:has-[>[data-align=block-start]]:[&>input]:pb-3",
        "dec:has-[>[data-align=block-end]]:h-auto dec:has-[>[data-align=block-end]]:flex-col dec:has-[>[data-align=block-end]]:[&>input]:pt-3",

        // Focus state.
        "dec:has-[[data-slot=input-group-control]:focus-visible]:border-ring dec:has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] dec:has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",

        // Error state.
        "dec:has-[[data-slot][aria-invalid=true]]:border-destructive dec:has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dec:dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",

        className,
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "dec:flex dec:h-auto dec:cursor-text dec:items-center dec:justify-center dec:gap-2 dec:py-1.5 dec:text-sm dec:font-medium dec:text-muted-foreground dec:select-none dec:group-data-[disabled=true]/input-group:opacity-50 dec:[&>kbd]:rounded-[calc(var(--radius)-5px)] dec:[&>svg:not([class*=size-])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "dec:order-first dec:pl-3 dec:has-[>button]:ml-[-0.45rem] dec:has-[>kbd]:ml-[-0.35rem]",
        "inline-end":
          "dec:order-last dec:pr-3 dec:has-[>button]:mr-[-0.45rem] dec:has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "dec:order-first dec:w-full dec:justify-start dec:px-3 dec:pt-3 dec:group-has-[>input]/input-group:pt-2.5 dec:[.border-b]:pb-3",
        "block-end":
          "dec:order-last dec:w-full dec:justify-start dec:px-3 dec:pb-3 dec:group-has-[>input]/input-group:pb-2.5 dec:[.border-t]:pt-3",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  },
);

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return;
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "dec:flex dec:items-center dec:gap-2 dec:text-sm dec:shadow-none",
  {
    variants: {
      size: {
        xs: "dec:h-6 dec:gap-1 dec:rounded-[calc(var(--radius)-5px)] dec:px-2 dec:has-[>svg]:px-2 dec:[&>svg:not([class*=size-])]:size-3.5",
        sm: "dec:h-8 dec:gap-1.5 dec:rounded-md dec:px-2.5 dec:has-[>svg]:px-2.5",
        "icon-xs": "dec:size-6 dec:rounded-[calc(var(--radius)-5px)] dec:p-0 dec:has-[>svg]:p-0",
        "icon-sm": "dec:size-8 dec:p-0 dec:has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  },
);

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "dec:flex dec:items-center dec:gap-2 dec:text-sm dec:text-muted-foreground dec:[&_svg]:pointer-events-none dec:[&_svg:not([class*=size-])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "dec:flex-1 dec:rounded-none dec:border-0 dec:bg-transparent dec:shadow-none dec:focus-visible:ring-0 dec:dark:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "dec:flex-1 dec:resize-none dec:rounded-none dec:border-0 dec:bg-transparent dec:py-3 dec:shadow-none dec:focus-visible:ring-0 dec:dark:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
