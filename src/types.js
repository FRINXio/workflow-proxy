/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type { ExpressRequest, ExpressResponse } from 'express';

export type Task = {
  name: string,
  type: string,
  defaultCase?: Array<Task>,
  decisionCases?: Map<string, Array<Task>>,
  forkTasks?: Array<Task>,
  subWorkflowParam?: { name: string },
};

export type ProxyRequest = ExpressRequest & {
  _parsedUrl: { pathname: string, query: string },
};

export type ProxyResponse = ExpressResponse & {
  write: mixed,
};
export type ProxyNext = (mixed) => void;

export type ProxyCallback = (proxyOptions?: mixed) => void;

export type IdentityHeaders = {
  roles: string[],
  groups: string[],
};

export type BeforeFun = (
  identity: IdentityHeaders,
  req: ProxyRequest,
  res: ProxyResponse,
  proxyCallback: ProxyCallback,
) => void;

export type AfterFun = (
  identity: IdentityHeaders,
  req: ProxyRequest,
  respObj: ?mixed,
  res: ProxyResponse,
) => void;

export type TransformerCtx = {
  proxyTarget: string,
  schellarTarget: string,
};

export type HttpMethod = 'get' | 'post' | 'delete' | 'put';

type ExpressCallback = (
  req: ProxyRequest,
  res: ProxyResponse,
  next: ProxyNext,
) => mixed;
type ExpressMethodFun = (string, ExpressCallback) => void;
export type ExpressRouter = { [HttpMethod]: ExpressMethodFun };

export type TransformerEntry = {
  method: HttpMethod,
  url: string,
  before?: BeforeFun,
  after?: AfterFun,
};

export type TransformerRegistrationFun = (
  ctx: TransformerCtx,
) => Array<TransformerEntry>;

export type Event = {
  name: string,
  event: string,
};

export type Workflow = {
  name: string,
  description: string,
  tasks: Array<Task>,
};

export type WorkflowExecution = {
  name: string,
  version: string,
};

export type StartWorkflowRequest = {
  name: string,
  workflowDef?: mixed,
  taskToDomain?: mixed,
  correlationId?: string,
};

export type ScheduleRequest = {
  name: string,
  workflowName: string,
  workflowVersion: string,
};

export type FrontendResponse = {
  text: string | {},
  statusCode: number,
};

export type TaskType = {
  name: string,
  taskType?: string,
  version: string,
  subWorkflowId: string,
  referenceTaskName: string,
  inputData?: {
    subWorkflowId: string,
    subWorkflowName: string,
    subWorkflowVersion: string,
  },
};
export type AuthorizationCheck = (IdentityHeaders) => boolean;
