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
import { AlertTriangle } from "lucide-react";

type ErrorPageProps = {
  title: string;
  message?: string | undefined;
  snippet?: string | undefined;
};

export const ErrorPage = ({ title, message, snippet }: ErrorPageProps) => {
  return (
    <div role="alert" aria-live="assertive" className="dec-error-state">
      <div className="dec:flex dec:items-center dec:gap-2">
        <AlertTriangle
          className="dec:size-5 dec:shrink-0 dec:text-red-600 dec:dark:text-red-400"
          aria-hidden="true"
        />
        <h2 className="dec-error-state__title">{title}</h2>
      </div>
      {message ? <p className="dec-error-state__message">{message}</p> : null}
      {snippet ? (
        <pre className="dec-error-state__snippet">
          <code>{snippet}</code>
        </pre>
      ) : null}
    </div>
  );
};
