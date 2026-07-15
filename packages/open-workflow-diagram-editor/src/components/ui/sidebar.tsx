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
import { cva, type VariantProps } from "class-variance-authority";
import { PanelRightIcon } from "lucide-react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_WIDTH = "20rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }
    },
    [setOpenProp, open],
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return setOpen((open) => !open);
  }, [setOpen]);

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      toggleSidebar,
    }),
    [state, open, setOpen, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "dec:group/sidebar-wrapper dec:flex dec:h-full dec:w-full dec:has-data-[variant=inset]:bg-sidebar",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}) {
  const { state } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "dec:flex dec:h-full dec:w-(--sidebar-width) dec:flex-col dec:bg-sidebar dec:text-sidebar-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "dec:relative dec:h-full dec:shrink-0 dec:overflow-hidden dec:transition-[width] dec:duration-200 dec:ease-linear dec:text-sidebar-foreground",
        state === "expanded" ? "dec:w-(--sidebar-width)" : "dec:w-0",
        className,
      )}
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
      {...props}
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        className={cn(
          "dec:flex dec:h-full dec:w-(--sidebar-width) dec:flex-col dec:bg-sidebar dec:overflow-hidden",
          side === "left" ? "dec:border-r" : "dec:border-l",
          "dec:border-sidebar-border",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn(
        "dec:size-7 dec:rounded-md dec:shadow-sm dec:bg-white dec:text-gray-500 dec:hover:text-gray-700 dec:hover:bg-gray-100 dec:dark:bg-gray-800 dec:dark:text-gray-300 dec:dark:hover:text-gray-100 dec:dark:hover:bg-gray-700 dec:cursor-pointer",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelRightIcon />
      <span className="dec:sr-only">Toggle Sidebar</span>
    </Button>
  );
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "dec:absolute dec:inset-y-0 dec:z-20 dec:hidden dec:w-4 dec:-translate-x-1/2 dec:transition-all dec:ease-linear dec:group-data-[side=left]:-right-4 dec:group-data-[side=right]:left-0 dec:after:absolute dec:after:inset-y-0 dec:after:left-1/2 dec:after:w-[2px] dec:hover:after:bg-sidebar-border dec:sm:flex",
        "dec:in-data-[side=left]:cursor-w-resize dec:in-data-[side=right]:cursor-e-resize",
        "dec:[[data-side=left][data-state=collapsed]_&]:cursor-e-resize dec:[[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "dec:group-data-[collapsible=offcanvas]:translate-x-0 dec:group-data-[collapsible=offcanvas]:after:left-full dec:hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "dec:[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "dec:[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className,
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "dec:relative dec:flex dec:w-full dec:flex-1 dec:flex-col dec:bg-background",
        "dec:md:peer-data-[variant=inset]:m-2 dec:md:peer-data-[variant=inset]:ml-0 dec:md:peer-data-[variant=inset]:rounded-xl dec:md:peer-data-[variant=inset]:shadow-sm dec:md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className,
      )}
      {...props}
    />
  );
}

function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("dec:h-8 dec:w-full dec:bg-background dec:shadow-none", className)}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn(
        "dec:flex dec:flex-col dec:gap-2 dec:px-3 dec:py-3 dec:border-b dec:border-sidebar-border dec:bg-sidebar",
        className,
      )}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("dec:flex dec:flex-col dec:gap-2 dec:p-2", className)}
      {...props}
    />
  );
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("dec:mx-2 dec:w-auto dec:bg-sidebar-border", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "dec:flex dec:min-h-0 dec:flex-1 dec:flex-col dec:gap-2 dec:overflow-auto dec:px-3 dec:py-3 dec:group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("dec:relative dec:flex dec:w-full dec:min-w-0 dec:flex-col dec:p-2", className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div";

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "dec:flex dec:h-8 dec:shrink-0 dec:items-center dec:rounded-md dec:px-2 dec:text-xs dec:font-medium dec:text-sidebar-foreground/70 dec:ring-sidebar-ring dec:outline-hidden dec:transition-[margin,opacity] dec:duration-200 dec:ease-linear dec:focus-visible:ring-2 dec:[&>svg]:size-4 dec:[&>svg]:shrink-0",
        "dec:group-data-[collapsible=icon]:-mt-8 dec:group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "dec:absolute dec:top-3.5 dec:right-3 dec:flex dec:aspect-square dec:w-5 dec:items-center dec:justify-center dec:rounded-md dec:p-0 dec:text-sidebar-foreground dec:ring-sidebar-ring dec:outline-hidden dec:transition-transform dec:hover:bg-sidebar-accent dec:hover:text-sidebar-accent-foreground dec:focus-visible:ring-2 dec:[&>svg]:size-4 dec:[&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "dec:after:absolute dec:after:-inset-2 dec:md:after:hidden",
        "dec:group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("dec:w-full dec:text-sm", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("dec:flex dec:w-full dec:min-w-0 dec:flex-col dec:gap-1", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("dec:group/menu-item dec:relative", className)}
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  "dec:peer/menu-button dec:flex dec:w-full dec:items-center dec:gap-2 dec:overflow-hidden dec:rounded-md dec:p-2 dec:text-left dec:text-sm dec:ring-sidebar-ring dec:outline-hidden dec:transition-[width,height,padding] dec:group-has-data-[sidebar=menu-action]/menu-item:pr-8 dec:group-data-[collapsible=icon]:size-8! dec:group-data-[collapsible=icon]:p-2! dec:hover:bg-sidebar-accent dec:hover:text-sidebar-accent-foreground dec:focus-visible:ring-2 dec:active:bg-sidebar-accent dec:active:text-sidebar-accent-foreground dec:disabled:pointer-events-none dec:disabled:opacity-50 dec:aria-disabled:pointer-events-none dec:aria-disabled:opacity-50 dec:data-[active=true]:bg-sidebar-accent dec:data-[active=true]:font-medium dec:data-[active=true]:text-sidebar-accent-foreground dec:data-[state=open]:hover:bg-sidebar-accent dec:data-[state=open]:hover:text-sidebar-accent-foreground dec:[&>span:last-child]:truncate dec:[&>svg]:size-4 dec:[&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "dec:hover:bg-sidebar-accent dec:hover:text-sidebar-accent-foreground",
        outline:
          "dec:bg-background dec:shadow-[0_0_0_1px_var(--sidebar-border)] dec:hover:bg-sidebar-accent dec:hover:text-sidebar-accent-foreground dec:hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "dec:h-8 dec:text-sm",
        sm: "dec:h-7 dec:text-xs",
        lg: "dec:h-12 dec:text-sm dec:group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot.Root : "button";
  const { state } = useSidebar();

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    };
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center" hidden={state !== "collapsed"} {...tooltip} />
    </Tooltip>
  );
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  showOnHover?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "dec:absolute dec:top-1.5 dec:right-1 dec:flex dec:aspect-square dec:w-5 dec:items-center dec:justify-center dec:rounded-md dec:p-0 dec:text-sidebar-foreground dec:ring-sidebar-ring dec:outline-hidden dec:transition-transform dec:peer-hover/menu-button:text-sidebar-accent-foreground dec:hover:bg-sidebar-accent dec:hover:text-sidebar-accent-foreground dec:focus-visible:ring-2 dec:[&>svg]:size-4 dec:[&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "dec:after:absolute dec:after:-inset-2 dec:md:after:hidden",
        "dec:peer-data-[size=sm]/menu-button:top-1",
        "dec:peer-data-[size=default]/menu-button:top-1.5",
        "dec:peer-data-[size=lg]/menu-button:top-2.5",
        "dec:group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "dec:group-focus-within/menu-item:opacity-100 dec:group-hover/menu-item:opacity-100 dec:peer-data-[active=true]/menu-button:text-sidebar-accent-foreground dec:data-[state=open]:opacity-100 dec:md:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "dec:pointer-events-none dec:absolute dec:right-1 dec:flex dec:h-5 dec:min-w-5 dec:items-center dec:justify-center dec:rounded-md dec:px-1 dec:text-xs dec:font-medium dec:text-sidebar-foreground dec:tabular-nums dec:select-none",
        "dec:peer-hover/menu-button:text-sidebar-accent-foreground dec:peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "dec:peer-data-[size=sm]/menu-button:top-1",
        "dec:peer-data-[size=default]/menu-button:top-1.5",
        "dec:peer-data-[size=lg]/menu-button:top-2.5",
        "dec:group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean;
}) {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, []);

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn(
        "dec:flex dec:h-8 dec:items-center dec:gap-2 dec:rounded-md dec:px-2",
        className,
      )}
      {...props}
    >
      {showIcon && (
        <Skeleton className="dec:size-4 dec:rounded-md" data-sidebar="menu-skeleton-icon" />
      )}
      <Skeleton
        className="dec:h-4 dec:max-w-(--skeleton-width) dec:flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "dec:mx-3.5 dec:flex dec:min-w-0 dec:translate-x-px dec:flex-col dec:gap-1 dec:border-l dec:border-sidebar-border dec:px-2.5 dec:py-0.5",
        "dec:group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("dec:group/menu-sub-item dec:relative", className)}
      {...props}
    />
  );
}

function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean;
  size?: "sm" | "md";
  isActive?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "dec:flex dec:h-7 dec:min-w-0 dec:-translate-x-px dec:items-center dec:gap-2 dec:overflow-hidden dec:rounded-md dec:px-2 dec:text-sidebar-foreground dec:ring-sidebar-ring dec:outline-hidden dec:hover:bg-sidebar-accent dec:hover:text-sidebar-accent-foreground dec:focus-visible:ring-2 dec:active:bg-sidebar-accent dec:active:text-sidebar-accent-foreground dec:disabled:pointer-events-none dec:disabled:opacity-50 dec:aria-disabled:pointer-events-none dec:aria-disabled:opacity-50 dec:[&>span:last-child]:truncate dec:[&>svg]:size-4 dec:[&>svg]:shrink-0 dec:[&>svg]:text-sidebar-accent-foreground",
        "dec:data-[active=true]:bg-sidebar-accent dec:data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "dec:text-xs",
        size === "md" && "dec:text-sm",
        "dec:group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
