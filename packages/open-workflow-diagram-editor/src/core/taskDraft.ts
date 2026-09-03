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

import type { Specification } from "@openworkflowspec/sdk";

/*
 * This module bridges react-hook-form (which uses string field names) with nested task objects                                      
 * (which have deep property paths). It solves a critical problem: react-hook-form interprets                                                                                                                  
 * dots (.), brackets ([]), and slashes (/) as path separators, but workflow task properties  
 * can contain these characters as literal parts of their keys.
 */
 
export type FieldChange = { segments: string[], value: unknown };

const UNSAFE_SEGMENT_CHARS = /[%./[\]]/g;
const ESCAPE_SEQUENCE = /%([0-9A-F]{2})/g;

// Escapes special characters in a single path segment to prevent react-hook-form from misinterpreting them
const encodeSegment = (segment: string): string =>
    segment.replace(UNSAFE_SEGMENT_CHARS,(char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
);

// Reverses the encoding to get back the original key name
const decodeSegment = (segment: string): string =>
    segment.replace(ESCAPE_SEQUENCE,(_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16))
);

// Converts a property path array into a single encoded string for react-hook-form
export function fieldName(segments: string[]): string {
    return segments.map(encodeSegment).join("/");
}

// Converts an encoded field name back into the original property path array
export function parseFieldName(name: string): string[] {
    return name.split("/").map(decodeSegment);
}

// Writes a value to a deeply nested property path, creating intermediate objects as needed.
function writeAtSegments(target: Record<string, unknown>, change: FieldChange): void {
    const {segments, value} = change;
    const leafKey = segments[segments.length - 1];

    if(leafKey === undefined) {
        return
    }

    let node = target

    for (const segment of segments.slice(0, -1)) {
        const next = node[segment]

        if(Array.isArray(next)) {
            // TODO not handled yet
            throw new Error("array editing not implemented yet")
        } 

        if(typeof next !== "object" || next === null){
            node[segment] = {}
        }

        node = node[segment] as Record<string, unknown>
    }

    if(value === undefined){
        delete node[leafKey]
        return
    }

    node[leafKey] = value
}


// Applies multiple field changes to a task, returning a new modified task
export function applyFieldValues(task: Specification.Task, changes: FieldChange[]): Specification.Task {
    const draft = structuredClone(task) as Record<string, unknown>

    for(const change of changes) {
        writeAtSegments(draft, change)
    }

    return draft as Specification.Task
}