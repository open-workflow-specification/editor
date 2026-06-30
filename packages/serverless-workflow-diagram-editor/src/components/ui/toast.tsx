/*
 * Copyright 2021-Present The Serverless Workflow Specification Authors
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
import { CircleAlert, CircleCheck, Info, TriangleAlert, XIcon } from "lucide-react";
import { Toast as ToastPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";

type ToastProps = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "error" | "success" | "warning" | "info";
  open: boolean;
};

const TOAST_VARIANT_STYLES_BASE = {
  error: {
    root: "dec:border-gray-200 dec:bg-white dec:text-gray-900 dec:dark:border-gray-700 dec:dark:bg-[#2d3748] dec:dark:text-gray-100",
    close:
      "dec:text-gray-600 hover:dec:text-gray-900 dec:dark:text-gray-400 dec:dark:hover:text-gray-100",
    icon: CircleAlert,
    iconColor: "dec:text-red-500",
    borderColor: "dec:border-l-red-500 dec:dark:border-l-red-500",
  },
  success: {
    root: "dec:border-gray-200 dec:bg-white dec:text-gray-900 dec:dark:border-gray-700 dec:dark:bg-[#2d3748] dec:dark:text-gray-100",
    close:
      "dec:text-gray-600 hover:dec:text-gray-900 dec:dark:text-gray-400 dec:dark:hover:text-gray-100",
    icon: CircleCheck,
    iconColor: "dec:text-green-500",
    borderColor: "dec:border-l-green-500 dec:dark:border-l-green-500",
  },
  warning: {
    root: "dec:border-gray-200 dec:bg-white dec:text-gray-900 dec:dark:border-gray-700 dec:dark:bg-[#2d3748] dec:dark:text-gray-100",
    close:
      "dec:text-gray-600 hover:dec:text-gray-900 dec:dark:text-gray-400 dec:dark:hover:text-gray-100",
    icon: TriangleAlert,
    iconColor: "dec:text-orange-500",
    borderColor: "dec:border-l-orange-500 dec:dark:border-l-orange-500",
  },
  info: {
    root: "dec:border-gray-200 dec:bg-white dec:text-gray-900 dec:dark:border-gray-700 dec:dark:bg-[#2d3748] dec:dark:text-gray-100",
    close:
      "dec:text-gray-600 hover:dec:text-gray-900 dec:dark:text-gray-400 dec:dark:hover:text-gray-100",
    icon: Info,
    iconColor: "dec:text-blue-500",
    borderColor: "dec:border-l-blue-500 dec:dark:border-l-blue-500",
  },
} as const;

const TOAST_VARIANT_STYLES = {
  ...TOAST_VARIANT_STYLES_BASE,
  default: TOAST_VARIANT_STYLES_BASE.info,
} as const;

const ToastItem = React.memo(
  ({ toast, onDismiss }: { toast: ToastProps; onDismiss: (id: string) => void }) => {
    const { id, open, variant = "default", title, description } = toast;
    const styles = TOAST_VARIANT_STYLES[variant];
    const Icon = styles.icon;

    return (
      <ToastPrimitive.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onDismiss(id);
        }}
        data-slot="toast"
        className={cn(
          "dec:pointer-events-auto dec:relative dec:flex dec:w-full dec:min-w-[320px] dec:max-w-[680px] dec:items-start dec:gap-4 dec:rounded-[14px] dec:border dec:border-l-4 dec:px-7 dec:py-6 dec:shadow-[0_18px_38px_rgba(22,23,24,0.12),0_8px_16px_rgba(22,23,24,0.08)] dec:transition-all dec:data-[state=open]:animate-in dec:data-[state=closed]:animate-out dec:data-[state=closed]:fade-out-80 dec:data-[state=closed]:slide-out-to-left-full dec:data-[state=open]:slide-in-from-top-full",
          styles.root,
          styles.borderColor,
        )}
      >
        {Icon && (
          <div className="dec:flex-shrink-0 dec:pt-0.5">
            <Icon className={cn("dec:size-[20px]", styles.iconColor)} />
          </div>
        )}
        <div className="dec:grid dec:flex-1 dec:gap-2 dec:pr-2">
          {title && (
            <ToastPrimitive.Title
              data-slot="toast-title"
              className="dec:text-[18px] dec:font-semibold dec:leading-[1.2] dec:tracking-[-0.01em]"
            >
              {title}
            </ToastPrimitive.Title>
          )}
          {description && (
            <ToastPrimitive.Description
              data-slot="toast-description"
              className="dec:text-[15px] dec:leading-[1.35] dec:text-[#6f6f78] dec:dark:text-gray-300"
            >
              {description}
            </ToastPrimitive.Description>
          )}
        </div>
        <ToastPrimitive.Close
          data-slot="toast-close"
          onClick={() => onDismiss(id)}
          className={cn(
            "dec:-mt-0.5 dec:rounded-md dec:p-1 dec:opacity-100 dec:transition-colors",
            styles.close,
          )}
        >
          <XIcon className="dec:size-[18px]" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    );
  },
);

ToastItem.displayName = "ToastItem";

function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
      <ToastPrimitive.Viewport className="dec:fixed dec:top-0 dec:left-0 dec:z-[100] dec:flex dec:max-w-[100vw] dec:flex-col dec:gap-3 dec:p-6 dec:pointer-events-none" />
    </>
  );
}

export { Toaster };
