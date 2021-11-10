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
import postgresExternalStorage from './proxy/transformers/postgres-external-storage';

import balancingTaskProxy from './balancing-task-proxy';
import {adminAccess} from "./proxy/utils";

import dotenv from "dotenv";

dotenv.config();

var helmet = require('helmet')
const app = ExpressApplication();
app.use(ExpressApplication.json({limit: '50mb', extended: true, type: "application/json"}));

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(helmet.dnsPrefetchControl());
app.use(helmet.expectCt());
app.use(helmet.frameguard());
app.use(helmet.hidePoweredBy());
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.referrerPolicy());
app.use(helmet.xssFilter());

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('/app/workflow-proxy/openapi/uniflow.json');

const userFacingPort = process.env.USER_FACING_PORT ?? 8088;
const taskProxyPort = process.env.TASK_PROXY_PORT ?? 8089;
const proxyTarget =
    process.env.PROXY_TARGET || 'http://conductor-server:8080';
const schellarTarget = process.env.SCHELLAR_TARGET || 'http://schellar:3000';
const tenantProxyUrl = 'http://localhost:8088/proxy/';

/*
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
      postgresExternalStorage,
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

  app.use(
    '/docs',
    swaggerUi.serve, 
    swaggerUi.setup(swaggerDocument)
  );

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
