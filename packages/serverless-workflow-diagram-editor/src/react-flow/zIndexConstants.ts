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

/**
 * Z-index layering constants for diagram edges and labels.
 *
 * Layering hierarchy (bottom to top):
 * 1. Regular edges (0)
 * 2. Selected edges (100)
 * 3. Edge labels - regular (1000)
 * 4. Edge labels - selected (1001)
 *
 * This ensures:
 * - Selected edges appear above regular edges
 * - All labels appear above all edges (preventing overlap)
 * - Selected edge labels appear above regular labels
 */
export const ZINDEX = {
  /** Regular (unselected) edges */
  EDGE_REGULAR: 0,

  /** Selected edges - appear above regular edges but below all labels */
  EDGE_SELECTED: 100,

  /** Regular (unselected) edge labels - appear above all edges */
  EDGE_LABEL_REGULAR: 1000,

  /** Selected edge labels - appear above everything */
  EDGE_LABEL_SELECTED: 1001,
} as const;
