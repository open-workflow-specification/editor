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

type ToastProps = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "error" | "success" | "warning" | "info";
  open: boolean;
};

type Action =
  | { type: "ADD"; toast: Omit<ToastProps, "open"> }
  | { type: "DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

let toasts: ToastProps[] = [];
let toastCount = 0;
const listeners: Array<(toasts: ToastProps[]) => void> = [];

function dispatch(action: Action) {
  if (action.type === "ADD") {
    toasts = [...toasts, { ...action.toast, open: true }];
    setTimeout(() => dispatch({ type: "DISMISS", id: action.toast.id }), 5000);
  } else if (action.type === "DISMISS") {
    toasts = toasts.map((t) => (t.id === action.id ? { ...t, open: false } : t));
    setTimeout(() => dispatch({ type: "REMOVE", id: action.id }), 300);
  } else if (action.type === "REMOVE") {
    toasts = toasts.filter((t) => t.id !== action.id);
  }
  listeners.forEach((listener) => listener(toasts));
}

function toast(props: Omit<ToastProps, "id" | "open">) {
  const id = String(toastCount++);
  dispatch({ type: "ADD", toast: { ...props, id } });
  return id;
}

function useToast() {
  const [state, setState] = React.useState<ToastProps[]>(toasts);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    toasts: state,
    show: toast,
    dismiss: (id: string) => dispatch({ type: "DISMISS", id }),
  };
}

export { useToast, toast };
