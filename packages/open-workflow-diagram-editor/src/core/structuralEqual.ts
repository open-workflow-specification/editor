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

import { createCustomEqual, type State } from "fast-equals";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Object.prototype.toString tag for plain objects and class instances. */
const OBJ_TAG = "[object Object]";
const toStringTag = Object.prototype.toString;

/**
 * Returns true when `v` is a plain object or user-defined class instance —
 * i.e. any non-null object whose `Object.prototype.toString` tag is
 * `[object Object]`.  This excludes arrays, Date, RegExp, Map, Set, typed
 * arrays and other built-in types that fast-equals handles natively.
 */
function isObjectLike(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && toStringTag.call(v) === OBJ_TAG;
}

const { keys } = Object;
const hasOwnProp = Object.prototype.hasOwnProperty;

// ---------------------------------------------------------------------------
// Custom fast-equals configuration
// ---------------------------------------------------------------------------

/**
 * Captures the underlying `EqualityComparator` built by fast-equals so we can
 * delegate non-object-like values (arrays, dates, sets, …) to it without
 * re-implementing those handlers ourselves.
 */
let _defaultCompare: (a: unknown, b: unknown, state: State<undefined>) => boolean;

/**
 * Constructor-agnostic recursive comparator used as `state.equals` by
 * fast-equals.
 *
 * **Object-like values** (any non-null object whose `toString` tag is
 * `[object Object]`, i.e. plain objects and user-defined class instances):
 * compared by own enumerable string keys and values, ignoring constructors and
 * prototype chains.  Property insertion order is irrelevant.
 *
 * **Array-like values** (anything where `Array.isArray` returns true, including
 * SDK array subclasses such as `TaskList`): compared element-by-element via
 * `innerEquals`, so constructor differences between e.g. `TaskList` and `Array`
 * are also ignored.
 *
 * **All other value types** (dates, maps, sets, typed arrays, primitives, …):
 * forwarded to `_defaultCompare`, the default fast-equals type-dispatching
 * comparator.
 *
 * Circular references are handled via `state.cache` (a `WeakMap` that
 * fast-equals provides when `circular: true` is set).
 */
function innerEquals(
  a: unknown,
  b: unknown,
  _keyA: unknown,
  _keyB: unknown,
  _parentA: unknown,
  _parentB: unknown,
  state: State<undefined>,
): boolean {
  if (isObjectLike(a) && isObjectLike(b)) {
    // `state.cache` is always a WeakMap when built with `circular: true`.
    const cache = state.cache as WeakMap<object, object>;
    // Circular-reference guard — mirrors fast-equals' createIsCircular.
    const cachedA = cache.get(a);
    const cachedB = cache.get(b);
    if (cachedA !== undefined && cachedB !== undefined) {
      return cachedA === b && cachedB === a;
    }
    cache.set(a, b);
    cache.set(b, a);

    const keysA = keys(a);
    let result = keysA.length === keys(b).length;
    if (result) {
      for (let i = 0; i < keysA.length; i++) {
        const k = keysA[i]!;
        if (!hasOwnProp.call(b, k) || !innerEquals(a[k], b[k], k, k, a, b, state)) {
          result = false;
          break;
        }
      }
    }

    cache.delete(a);
    cache.delete(b);
    return result;
  }

  // Handle array subclasses (e.g. SDK's TaskList vs a plain Array).
  // fast-equals' internal routing comparator checks `a.constructor !== b.constructor`
  // before it reaches the Array.isArray fast-path, so cross-constructor arrays
  // must be handled here to avoid a false-negative.
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!innerEquals(a[i], b[i], i, i, a, b, state)) return false;
    }
    return true;
  }

  return _defaultCompare(a, b, state);
}

/**
 * A `createCustomEqual` instance with `circular: true` whose
 * `createInternalComparator` captures `_defaultCompare` and installs
 * `innerEquals` as `state.equals`.  The instance is also used as the
 * fallback comparator for non-object-like root values.
 */
const _fastEquals = createCustomEqual({
  circular: true,
  createInternalComparator: (defaultCompare) => {
    _defaultCompare = defaultCompare;
    return innerEquals;
  },
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compares two values for deep structural equality, **ignoring constructor and
 * class identity** for object-like values.
 *
 * **Behaviour**
 * - A plain `{ x: 1 }` and `new Foo(1)` (where `Foo` sets `this.x = x`) are
 *   considered equal.  Two instances of *different* classes with identical own
 *   enumerable properties are also considered equal.
 * - Property insertion order is irrelevant.
 * - Circular references are handled safely — no stack overflow.
 * - Arrays, dates, sets, maps, typed arrays and primitives are compared by
 *   value using `fast-equals`' built-in handlers.
 *
 * @param a - First value to compare.
 * @param b - Second value to compare.
 * @returns `true` if the two values are structurally equal.
 */
export function structuralEqual(a: unknown, b: unknown): boolean {
  // For object-like values and array subclasses, the `_fastEquals` entry point
  // has a hard `constructor !== b.constructor → false` guard that we must bypass.
  // Invoke `innerEquals` directly with a fresh state for both cases.
  if ((isObjectLike(a) && isObjectLike(b)) || (Array.isArray(a) && Array.isArray(b))) {
    const state: State<undefined> = {
      cache: new WeakMap(),
      equals: innerEquals,
      meta: undefined,
      strict: false,
    };
    return innerEquals(a, b, undefined, undefined, undefined, undefined, state);
  }
  // Primitives, dates, maps, sets, and other non-object-like values — delegate
  // to fast-equals so we don't have to replicate its type handlers.
  return _fastEquals(a, b);
}
