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

export { default as accumulateRoomReadings } from "./workflows/accumulate-room-readings.yaml?raw";
export { default as authenticationOAuth2 } from "./workflows/authentication-oauth2.yaml?raw";
export { default as authenticationReusable } from "./workflows/authentication-reusable.yaml?raw";
export { default as callAsyncAPIPublish } from "./workflows/call-asyncapi-publish.yaml?raw";
export { default as callAsyncAPISubscribe } from "./workflows/call-asyncapi-subscribe-consume-forever-foreach.yaml?raw";
export { default as callCustomFunctionCataloged } from "./workflows/call-custom-function-cataloged.yaml?raw";
export { default as callCustomFunctionInline } from "./workflows/call-custom-function-inline.yaml?raw";
export { default as callGrpc } from "./workflows/call-grpc.yaml?raw";
export { default as callHttpQueryHeadersExpressions } from "./workflows/call-http-query-headers-expressions.yaml?raw";
export { default as callMCP } from "./workflows/call-mcp.yaml?raw";
export { default as callOpenApi } from "./workflows/call-openapi.yaml?raw";
export { default as conditionalTask } from "./workflows/conditional-task.yaml?raw";
export { default as doMultiple } from "./workflows/do-multiple.yaml?raw";
export { default as doSingle } from "./workflows/do-single.yaml?raw";
export { default as emit } from "./workflows/emit.yaml?raw";
export { default as forExample } from "./workflows/for.yaml?raw";
export { default as fork } from "./workflows/fork.yaml?raw";
export { default as listenToAll } from "./workflows/listen-to-all.yaml?raw";
export { default as listenToOne } from "./workflows/listen-to-one.yaml?raw";
export { default as listenToAnyForeverForeach } from "./workflows/listen-to-any-forever-foreach.yaml?raw";
export { default as mockServiceExtension } from "./workflows/mock-service-extension.yaml?raw";
export { default as raiseReusable } from "./workflows/raise-reusable.yaml?raw";
export { default as runContainerStdinAndArguments } from "./workflows/run-container-stdin-and-arguments.yaml?raw";
export { default as runReturnAll } from "./workflows/run-return-all.yaml?raw";
export { default as runScriptWithStdinAndArguments } from "./workflows/run-script-with-stdin-and-arguments.yaml?raw";
export { default as runShellStdinAndArguments } from "./workflows/run-shell-stdin-and-arguments.yaml?raw";
export { default as runSubflow } from "./workflows/run-subflow.yaml?raw";
export { default as scheduleCron } from "./workflows/schedule-cron.yaml?raw";
export { default as scheduleEventDriven } from "./workflows/schedule-event-driven.yaml?raw";
export { default as set } from "./workflows/set.yaml?raw";
export { default as starWarsHomeworld } from "./workflows/star-wars-homeworld.yaml?raw";
export { default as switchThenString } from "./workflows/switch-then-string.yaml?raw";
export { default as tryCatchRetryReusable } from "./workflows/try-catch-retry-reusable.yaml?raw";
export { default as tryCatchThen } from "./workflows/try-catch-then.yaml?raw";
export { default as waitDurationInline } from "./workflows/wait-duration-inline.yaml?raw";
