/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */
'use strict';

import type {$Application, ExpressRequest, ExpressResponse} from 'express';
import ExpressApplication from 'express';
import proxy from './proxy/proxy';
import workflowRouter from './routes';
import {getUserGroups, getUserRoles} from './proxy/utils.js';

import bulk from './proxy/transformers/bulk';
import event from './proxy/transformers/event';
import metadataTaskdef from './proxy/transformers/metadata-taskdef';
import metadataWorkflowdef from './proxy/transformers/metadata-workflowdef';
import schellar from './proxy/transformers/schellar';
import task from './proxy/transformers/task';
import workflow from './proxy/transformers/workflow';

import metadataWorkflowdefRbac from './proxy/transformers/metadata-workflowdef-rbac';
import workflowRbac from './proxy/transformers/workflow-rbac';
import taskProxy from './task-proxy';
import schellarProxy from './schellar-proxy';
import {adminAccess, generalAccess} from "./proxy/utils";

import dotenv from "dotenv";

dotenv.config();

const app = ExpressApplication();

const schellarProxyPort = process.env.SCHELLAR_PROXY_PORT ?? 8087;
const userFacingPort = process.env.USER_FACING_PORT ?? 8088;
const taskProxyPort = process.env.TASK_PROXY_PORT ?? 8089;
const proxyTarget =
    process.env.PROXY_TARGET || 'http://conductor-server:8080';
const schellarTarget = process.env.SCHELLAR_TARGET || 'http://schellar:3000';
const tenantProxyUrl = 'http://localhost:8088/proxy/';
const rbacProxyUrl = 'http://localhost:8088/rbac_proxy/';

/*
 User facing proxy architecture (exposed in api_gateway):

+-----------------------------------------------------------+
| Workflow-proxy                                            |
|                                                           |
|                                /rbac                      |
| /                              /rbac/editableworkflows    |
|  +----------------------+       +----------------------+  |
|  | Conductor proxy      |       | Conductor proxy      |  |
|  |  routes.js           |       |  routes.js           |  |
|  |                      |       |                      |  |
|  +----------+-----------+       +-----------+----------+  |
|             | HTTP                          | HTTP        |
| /proxy      |                  /rbac_proxy  |             |
|  +----------v-----------+       +-----------v----------+  |
|  | Tenant proxy         |       | RBAC proxy           |  |
|  |  proxy.js            <-------+  proxy.js            |  |
|  |  transformers/*.js   |  HTTP |  trans/*-rbac.js     |  |
|  +-----------+----------+       +----------------------+  |
|              |                             |              |
+-----------------------------------------------------------+
               |                             |
               |                             |
               | HTTP                        | HTTP
               |                             |
               |             /api            |
           +---v-----------------------------v---+
           | Conductor built in REST API         |
           |                                     |
           |                                     |
           +-------------------------------------+

TODO: merge conductor proxy with tenant / rbac proxy
TODO: do not make a real HTTP call between rbac_proxy and proxy (extract the functionality from express server if possible)
.. to remove redundant HTTP calls inside the same process/container
*/

async function init() {
  const proxyRouter = await proxy(
    proxyTarget,
    tenantProxyUrl,
    rbacProxyUrl,
    schellarTarget,
    // TODO populate from fs
    [
      bulk,
      event,
      metadataTaskdef,
      metadataWorkflowdef,
      workflow,
      task,
      schellar,
    ],
    adminAccess,
  );
  app.use('/', await workflowRouter(tenantProxyUrl));
  app.use('/proxy', proxyRouter);

  const rbacConductorRouter: $Application<
    ExpressRequest,
    ExpressResponse,
  > = await workflowRouter(rbacProxyUrl);
  // Expose a simple boolean endpoint to check if current user is privileged
  rbacConductorRouter.get(
    '/editableworkflows',
    async (req: ExpressRequest, res) => {
      res
        .status(200)
        .send(
          adminAccess({
            "tenantId": "",
            roles: getUserRoles(req),
            groups: getUserGroups(req)}),
        );
    },
  );

  const rbacRouter = await proxy(
    proxyTarget,
    tenantProxyUrl,
    rbacProxyUrl,
    'UNSUPPORTED', // Scheduling not allowed
    [
      metadataWorkflowdefRbac,
      workflowRbac,
      // FIXME override task and bulk and implement user group checks
      task,
      bulk,
    ],
    generalAccess,
  );

  app.use('/rbac', rbacConductorRouter);
  app.use('/rbac_proxy', rbacRouter);
  app.get("/probe/liveness", (req, res) => res.sendStatus(200));
  app.get("/probe/readiness", (req, res) => res.sendStatus(200));
  app.listen(userFacingPort);
  taskProxy.init(proxyTarget, taskProxyPort);
  schellarProxy.init(proxyTarget, schellarProxyPort);
}

init();
