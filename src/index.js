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

import balancingTaskProxy from './balancing-task-proxy';
import {adminAccess} from "./proxy/utils";

import dotenv from "dotenv";

dotenv.config();

const app = ExpressApplication();

const userFacingPort = process.env.USER_FACING_PORT ?? 8088;
const taskProxyPort = process.env.TASK_PROXY_PORT ?? 8089;
const proxyTarget =
    process.env.PROXY_TARGET || 'http://conductor-server:8080';
const schellarTarget = process.env.SCHELLAR_TARGET || 'http://schellar:3000';
const tenantProxyUrl = 'http://localhost:8088/proxy/';

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
  let tenantRouter = workflowRouter(tenantProxyUrl);

  // Expose a simple boolean endpoint to check if current user is privileged
  proxyRouter.get(
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

  app.use('/', await tenantRouter);
  app.use('/proxy', proxyRouter);

  app.get("/probe/liveness", (req, res) => {
    if (balancingTaskProxy.live()) {
      res.sendStatus(200);
    } else {
      res.sendStatus(500);
    }
  });
  app.get("/probe/readiness", (req, res) => {
    if (balancingTaskProxy.ready()) {
      res.sendStatus(200);
    } else {
      res.sendStatus(500);
    }
  });
  app.listen(userFacingPort);
  balancingTaskProxy.init(proxyTarget, taskProxyPort);
}

init();
