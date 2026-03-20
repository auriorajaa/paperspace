/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as collections from "../collections.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as formConnections from "../formConnections.js";
import type * as googleAccounts from "../googleAccounts.js";
import type * as http from "../http.js";
import type * as processFormResponses from "../processFormResponses.js";
import type * as templates from "../templates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  collections: typeof collections;
  crons: typeof crons;
  documents: typeof documents;
  formConnections: typeof formConnections;
  googleAccounts: typeof googleAccounts;
  http: typeof http;
  processFormResponses: typeof processFormResponses;
  templates: typeof templates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
