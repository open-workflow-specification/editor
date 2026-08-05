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

"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

const Combobox = ComboboxPrimitive.Root;

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />;
}

function ComboboxTrigger({ className, children, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("dec:[&_svg:not([class*=size-])]:size-4", className)}
      {...props}
    >
      {children}
      <ChevronDownIcon
        data-slot="combobox-trigger-icon"
        className="dec:pointer-events-none dec:size-4 dec:text-slate-500 dec:dark:text-slate-400"
      />
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxClear({ className, ...props }: ComboboxPrimitive.Clear.Props) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      {...props}
    >
      <XIcon className="dec:pointer-events-none" />
    </ComboboxPrimitive.Clear>
  );
}

function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean;
  showClear?: boolean;
}) {
  return (
    <InputGroup className={cn("dec:w-auto", className)}>
      <ComboboxPrimitive.Input render={<InputGroupInput disabled={disabled} />} {...props} />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            asChild
            data-slot="input-group-button"
            className="dec:group-has-data-[slot=combobox-clear]/input-group:hidden dec:data-pressed:bg-transparent"
            disabled={disabled}
          >
            <ComboboxTrigger />
          </InputGroupButton>
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  );
}

function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="dec:isolate dec:z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          className={cn(
            "dec:group/combobox-content dec:relative dec:max-h-96 dec:w-(--anchor-width) dec:max-w-(--available-width) dec:min-w-[calc(var(--anchor-width)+--spacing(7))] dec:origin-(--transform-origin) dec:overflow-hidden dec:rounded-md  dec:shadow-md dec:ring-1 dec:bg-white dec:text-slate-900 dec:border dec:border-slate-200 dec:shadow-lg dec:dark:bg-[#1f2937] dec:dark:text-slate-100 dec:dark:border-slate-700 dec:duration-100 dec:data-[chips=true]:min-w-(--anchor-width) dec:data-[side=bottom]:slide-in-from-top-2 dec:data-[side=left]:slide-in-from-right-2 dec:data-[side=right]:slide-in-from-left-2 dec:data-[side=top]:slide-in-from-bottom-2 dec:*:data-[slot=input-group]:m-1 dec:*:data-[slot=input-group]:mb-0 dec:*:data-[slot=input-group]:h-8 dec:*:data-[slot=input-group]:border-input/30 dec:*:data-[slot=input-group]:bg-input/30 dec:*:data-[slot=input-group]:shadow-none dec:data-open:animate-in dec:data-open:fade-in-0 dec:data-open:zoom-in-95 dec:data-closed:animate-out dec:data-closed:fade-out-0 dec:data-closed:zoom-out-95",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "dec:max-h-[min(calc(--spacing(96)---spacing(9)),calc(var(--available-height)---spacing(9)))] dec:scroll-py-1 dec:overflow-y-auto dec:p-1 dec:data-empty:p-0",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "dec:relative dec:flex dec:w-full dec:cursor-default dec:items-center dec:gap-2 dec:rounded-sm dec:py-1.5 dec:pr-8 dec:pl-2 dec:text-sm dec:outline-hidden dec:select-none dec:data-highlighted:bg-slate-100 dec:data-highlighted:text-slate-900 dec:dark:data-highlighted:bg-slate-700 dec:dark:data-highlighted:text-white dec:data-[disabled]:pointer-events-none dec:data-[disabled]:opacity-50 dec:[&_svg]:pointer-events-none dec:[&_svg]:shrink-0 dec:[&_svg:not([class*=size-])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        data-slot="combobox-item-indicator"
        render={
          <span className="dec:pointer-events-none dec:absolute dec:right-2 dec:flex dec:size-4 dec:items-center dec:justify-center" />
        }
      >
        <CheckIcon className="dec:pointer-events-none dec:size-4 dec:pointer-coarse:size-5" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
  return (
    <ComboboxPrimitive.Group data-slot="combobox-group" className={cn(className)} {...props} />
  );
}

function ComboboxLabel({ className, ...props }: ComboboxPrimitive.GroupLabel.Props) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn(
        "dec:px-2 dec:py-1.5 dec:text-xs dec:text-slate-500 dec:dark:text-slate-400 dec:pointer-coarse:px-3 dec:pointer-coarse:py-2 dec:pointer-coarse:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
  return <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />;
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "dec:hidden dec:w-full dec:justify-center dec:py-2 dec:text-center dec:text-sm dec:text-slate-500 dec:dark:text-slate-400 dec:group-data-empty/combobox-content:flex",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxSeparator({ className, ...props }: ComboboxPrimitive.Separator.Props) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn(
        "dec:-mx-1 dec:my-1 dec:h-px dec:bg-slate-200 dec:dark:bg-slate-700",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> & ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "dec:flex dec:min-h-9 dec:flex-wrap dec:items-center dec:gap-1.5 dec:rounded-md dec:border dec:bg-clip-padding dec:px-2.5 dec:py-1.5 dec:text-sm dec:shadow-xs dec:transition-[color,box-shadow] dec:focus-within:ring-[3px] dec:has-aria-invalid:ring-[3px] dec:has-data-[slot=combobox-chip]:px-1.5 dec:border-slate-300 dec:bg-white dec:text-slate-900 dec:hover:border-slate-400 dec:focus-within:border-blue-500 dec:focus-within:ring-[3px] dec:focus-within:ring-blue-500/20    dec:has-aria-invalid:border-red-500 dec:has-aria-invalid:ring-red-500/20 dec:dark:border-slate-600 dec:dark:bg-[#1f2937] dec:dark:text-slate-100 dec:dark:hover:border-slate-500 dec:dark:focus-within:border-blue-400 dec:dark:focus-within:ring-blue-400/20",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean;
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "dec:flex dec:h-[calc(--spacing(5.5))] dec:w-fit dec:items-center dec:justify-center dec:gap-1 dec:rounded-sm dec:px-1.5 dec:text-xs dec:font-medium dec:whitespace-nowrap dec:has-disabled:pointer-events-none dec:has-disabled:cursor-not-allowed dec:has-disabled:opacity-50 dec:has-data-[slot=combobox-chip-remove]:pr-0 dec:bg-slate-100 dec:text-slate-800 dec:dark:bg-slate-700 dec:dark:text-slate-100",
        className,
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="dec:-ml-1 dec:opacity-50 dec:hover:opacity-100"
          data-slot="combobox-chip-remove"
        >
          <XIcon className="dec:pointer-events-none" />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  );
}

function ComboboxChipsInput({ className, children, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("dec:min-w-16 dec:flex-1 dec:outline-none", className)}
      {...props}
    />
  );
}

function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null);
}

export {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
