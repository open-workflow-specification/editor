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

import type { LanguageServiceContext, LanguageServicePlugin } from "@volar/language-service";
import { resolveReference } from "volar-service-json";
import { create } from "volar-service-yaml";
import { workflowSchema } from "@openworkflowspec/sdk";
import { URI } from "vscode-uri";

const DEFAULT_SCHEMA_URI = "urn:open-workflow-specification:workflow-schema";

/**
 * Returns a WorkspaceContextService that correctly handles absolute URIs.
 *
 * The default getWorkspaceContextService() of volar-service-yaml always resolves references
 * with vscode-uri Utils.resolvePath(), which treats absolute URIs (e.g. the schema $id
 * "https://.../workflow.json") as relative paths. This causes silent schema resolution failures.
 *
 * This implementation delegates to resolveReference() from volar-service-json, which
 * preserves absolute URIs and only resolves relative ones — mirroring the logic already
 * used by the JSON language service.
 */
function createWorkspaceContextService(context: LanguageServiceContext) {
  return {
    resolveRelativePath(ref: string, resource: string): string {
      const base = resource.substring(0, resource.lastIndexOf("/") + 1);
      let baseUri = URI.parse(base);
      const decoded = context.decodeEmbeddedDocumentUri?.(baseUri);
      if (decoded) {
        baseUri = decoded[0];
      }
      return resolveReference(ref, baseUri, context.env.workspaceFolders);
    },
  };
}

export function createYamlSchemaLanguageServicePlugin(): LanguageServicePlugin {
  const plugin = create({
    getWorkspaceContextService: createWorkspaceContextService,
    getLanguageSettings() {
      return {
        completion: true,
        validate: true,
        hover: true,
        schemas: [
          {
            uri: workflowSchema.$id || DEFAULT_SCHEMA_URI,
            fileMatch: ["*.yaml", "*.yml"],
            schema: structuredClone(workflowSchema),
          },
        ],
      };
    },
  });

  return {
    ...plugin,
    create(context) {
      // Drop the native YAML schema CodeLenses: their `jumpToSchema` command is not supported.
      const { provideCodeLenses: _, resolveCodeLens: __, ...instance } = plugin.create(context);
      return instance;
    },
  };
}
