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
import { HelpCircle } from "lucide-react";
import { useI18n } from "@openworkflowspec/i18n";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { RemoveFieldButton } from "./removeField";
import { useTaskFormContext } from "./taskFormContext";

// ---------------------------------------------------------------------------
// FieldLabel — label text + optional description tooltip
// ---------------------------------------------------------------------------

export function FieldLabel({
  htmlFor,
  label,
  required,
  description,
  changed = false,
  fieldPath,
}: {
  htmlFor?: string;
  label: string;
  required: boolean;
  description?: string;
  changed?: boolean;
  /** The field this label names: its ✕ goes at the row's end when it is removable. */
  fieldPath?: string;
}) {
  const { isReadOnly } = useTaskFormContext();
  return (
    <div className="dec-form-field-label-row">
      {changed && (
        <span className="dec-form-field-gutter-dot">
          <ChangedDot />
        </span>
      )}
      {isReadOnly ? (
        <span className="dec-form-field-label">{label}</span>
      ) : (
        <label htmlFor={htmlFor} className="dec-form-field-label">
          {label}
        </label>
      )}
      <RequiredMark required={required} />
      {description && <HelpTooltip label={label} description={description} />}
      <RemoveFieldButton path={fieldPath} />
    </div>
  );
}

/** The dot after a changed field's label, or beside a changed map entry. */
export function ChangedDot() {
  const { t } = useI18n();
  return (
    <span
      className="dec-form-field-changed"
      role="img"
      aria-label={t("sidebar.form.fieldChanged")}
      title={t("sidebar.form.fieldChanged")}
    />
  );
}

/**
 * The `*` after a required field's name (not in read-only).
 */
export function RequiredMark({
  required,
  spaced = false,
}: {
  required: boolean;
  spaced?: boolean;
}) {
  const { isReadOnly } = useTaskFormContext();
  if (!required || isReadOnly) return null;
  return (
    <span className="dec-form-field-required" aria-hidden="true">
      {spaced ? " *" : "*"}
    </span>
  );
}

/** How long the pointer rests on a "?" before its help opens, so passing over it opens nothing. */
export const HELP_TOOLTIP_DELAY_MS = 500;

/**
 * The "?" after a field's label or heading. Its help opens on hover (after
 * `HELP_TOOLTIP_DELAY_MS`) or focus, and a click or tap toggles it, since touch has no hover.
 */
export function HelpTooltip({ label, description }: { label: string; description: string }) {
  const { t } = useI18n();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [root, setRoot] = React.useState<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(false);
  // Radix closes a tooltip on pointerdown, before the click: the click toggles from the state the press found.
  const openAtPress = React.useRef<boolean | null>(null);

  const onOpenChange = (next: boolean) => {
    // This editor's own root, never `document.querySelector`: a host may embed more than one.
    if (next) setRoot(triggerRef.current?.closest<HTMLElement>(".dec-root") ?? null);
    setOpen(next);
  };

  return (
    <TooltipPrimitive.Provider delayDuration={HELP_TOOLTIP_DELAY_MS} skipDelayDuration={0}>
      <TooltipPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <TooltipPrimitive.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            className="dec-form-field-help"
            aria-label={`${t("aria.help")}: ${label}`}
            onPointerDown={() => {
              openAtPress.current = open;
            }}
            onClick={(event) => {
              // Stops Radix's own close-on-click
              event.preventDefault();
              const wasOpen = openAtPress.current ?? open;
              openAtPress.current = null;
              onOpenChange(!wasOpen);
            }}
          >
            <HelpCircle className="dec-form-field-help-icon" aria-hidden="true" />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal container={root}>
          <TooltipPrimitive.Content
            className="dec-popover dec-help-tooltip"
            // The ? is already named "Help: <label>", so screen readers get the description alone
            aria-label={description}
            side="bottom"
            sideOffset={6}
            align="start"
            alignOffset={-8}
            collisionPadding={8}
          >
            <p className="dec-help-tooltip-title">{label}</p>
            <p className="dec-help-tooltip-text">{description}</p>
            <TooltipPrimitive.Arrow asChild width={12} height={6}>
              <span className="dec-popover-arrow" aria-hidden="true" />
            </TooltipPrimitive.Arrow>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
