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
    <div role="alert" aria-live="assertive" className="dec:p-6">
      <div className="dec:flex dec:items-center dec:gap-2">
        <AlertTriangle
          className="dec:size-5 dec:shrink-0 dec:text-red-600 dec:dark:text-red-400"
          aria-hidden="true"
        />
        <h2 className="dec:text-base dec:font-semibold dec:text-gray-900 dec:dark:text-gray-100">
          {title}
        </h2>
      </div>
      {message ? (
        <p className="dec:mt-1 dec:text-sm dec:text-gray-600 dec:dark:text-gray-100">{message}</p>
      ) : null}
      {snippet ? (
        <pre className="dec:mt-3 dec:p-3 dec:overflow-x-auto dec:rounded dec:bg-gray-100 dec:text-sm dec:text-gray-800 dec:dark:bg-gray-800 dec:dark:text-gray-200">
          <code>{snippet}</code>
        </pre>
      ) : null}
    </div>
  );
};
