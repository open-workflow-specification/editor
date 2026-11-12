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
import type { Preview } from "@storybook/react-vite";
import type { Decorator } from "@storybook/react-vite";
import { useArgs, useGlobals } from "storybook/preview-api";

const withColorMode: Decorator = (Story) => {
  const [{ colorMode: argColorMode }, updateArgs] = useArgs();
  const [{ colorMode: globalColorMode }, updateGlobals] = useGlobals();
  const isFirstRender = React.useRef(true);
  const lastArgColorMode = React.useRef(argColorMode);
  const lastGlobalColorMode = React.useRef(globalColorMode);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (globalColorMode !== undefined && argColorMode !== globalColorMode) {
        updateArgs({ colorMode: globalColorMode });
      }
      lastArgColorMode.current = globalColorMode;
      lastGlobalColorMode.current = globalColorMode;
      return;
    }

    const argsChanged = argColorMode !== lastArgColorMode.current;
    const globalChanged = globalColorMode !== lastGlobalColorMode.current;

    if (argsChanged) {
      updateGlobals({ colorMode: argColorMode });
    } else if (globalChanged) {
      updateArgs({ colorMode: globalColorMode });
    }

    lastArgColorMode.current = argColorMode;
    lastGlobalColorMode.current = globalColorMode;
  }, [argColorMode, globalColorMode, updateArgs, updateGlobals]);

  return <Story />;
};

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
    a11y: { test: "todo" },
  },
  globalTypes: {
    colorMode: {
      description: "Global color mode for components",
      defaultValue: "system",
      toolbar: {
        title: "Color Mode",
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light" },
          { value: "dark", icon: "moon", title: "Dark" },
          { value: "system", icon: "browser", title: "System" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withColorMode],
};

export default preview;
