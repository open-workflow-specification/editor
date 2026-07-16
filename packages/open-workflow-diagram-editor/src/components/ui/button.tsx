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
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "dec:inline-flex dec:shrink-0 dec:items-center dec:justify-center dec:gap-2 dec:rounded-md dec:text-sm dec:font-medium dec:whitespace-nowrap dec:transition-all dec:outline-none dec:focus-visible:border-ring dec:focus-visible:ring-[3px] dec:focus-visible:ring-ring/50 dec:disabled:pointer-events-none dec:disabled:opacity-50 dec:aria-invalid:border-destructive dec:aria-invalid:ring-destructive/20 dec:dark:aria-invalid:ring-destructive/40 dec:[&_svg]:pointer-events-none dec:[&_svg]:shrink-0 dec:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "dec:bg-primary dec:text-primary-foreground dec:hover:bg-primary/90",
        destructive:
          "dec:bg-destructive dec:text-white dec:hover:bg-destructive/90 dec:focus-visible:ring-destructive/20 dec:dark:bg-destructive/60 dec:dark:focus-visible:ring-destructive/40",
        outline:
          "dec:border dec:bg-background dec:shadow-xs dec:hover:bg-accent dec:hover:text-accent-foreground dec:dark:border-input dec:dark:bg-input/30 dec:dark:hover:bg-input/50",
        secondary: "dec:bg-secondary dec:text-secondary-foreground dec:hover:bg-secondary/80",
        ghost: "dec:hover:bg-accent dec:hover:text-accent-foreground dec:dark:hover:bg-accent/50",
        link: "dec:text-primary dec:underline-offset-4 dec:hover:underline",
      },
      size: {
        default: "dec:h-9 dec:px-4 dec:py-2 dec:has-[>svg]:px-3",
        xs: "dec:h-6 dec:gap-1 dec:rounded-md dec:px-2 dec:text-xs dec:has-[>svg]:px-1.5 dec:[&_svg:not([class*=size-])]:size-3",
        sm: "dec:h-8 dec:gap-1.5 dec:rounded-md dec:px-3 dec:has-[>svg]:px-2.5",
        lg: "dec:h-10 dec:rounded-md dec:px-6 dec:has-[>svg]:px-4",
        icon: "dec:size-9",
        "icon-xs": "dec:size-6 dec:rounded-md dec:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "dec:size-8",
        "icon-lg": "dec:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
