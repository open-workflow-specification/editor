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

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import "./sonner.css";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-left"
      className="dec:toaster dec:group"
      closeButton
      icons={{
        success: <CircleCheckIcon className="dec:size-4" style={{ color: "#22c55e" }} />,
        info: <InfoIcon className="dec:size-4" style={{ color: "#3b82f6" }} />,
        warning: <TriangleAlertIcon className="dec:size-4" style={{ color: "#f97316" }} />,
        error: <OctagonXIcon className="dec:size-4" style={{ color: "#ef4444" }} />,
        loading: <Loader2Icon className="dec:size-4 dec:animate-spin" />,
        close: <XIcon size={14} />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
