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

import type { ExpressRequest } from 'express';
import ExpressApplication from 'express';
import proxy from './proxy/proxy';
import workflowRouter from './routes';
import { getUserGroups, getUserRoles } from './proxy/utils.js';

import bulk from './proxy/transformers/bulk';
import event from './proxy/transformers/event';
import metadataTaskdef from './proxy/transformers/metadata-taskdef';
import metadataWorkflowdef from './proxy/transformers/metadata-workflowdef';
import schellar from './proxy/transformers/schellar';
import task from './proxy/transformers/task';
import workflow from './proxy/transformers/workflow';
import postgresExternalStorage from './proxy/transformers/postgres-external-storage';

import { adminAccess } from './proxy/utils';

import dotenv from 'dotenv';

dotenv.config();

require('log-timestamp');

var helmet = require('helmet');
const app = ExpressApplication();
app.use(
  ExpressApplication.json({
    limit: process.env.TASK_PROXY_LIMIT ?? '50mb',
    extended: true,
    type: 'application/json',
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: {
      policy: 'unsafe-none',
    },
  }),
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
const workflowManagerSwaggerDocument = require('./openapi/workflow-manager.json');
const uniconfigSwaggerDocument = require('./openapi/uniconfig.json');

const userFacingPort = process.env.USER_FACING_PORT ?? 8088;
const proxyTarget = process.env.PROXY_TARGET || 'http://conductor-server:8080';
const schellarTarget = process.env.SCHELLAR_TARGET || 'http://schellar:3000';
const tenantProxyUrl = 'http://localhost:8088/proxy/';

const serverTimeout = process.env.SERVER_TIMEOUT ?? 20000;
const serverKeepAliveTimeout = process.env.SERVER_KEEP_ALIVE_TIMEOUT ?? 20000;

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
  proxyRouter.get('/editableworkflows', async (req: ExpressRequest, res) => {
    res.status(200).send(
      adminAccess({
        tenantId: '',
        roles: getUserRoles(req),
        groups: getUserGroups(req),
      }),
    );
  });

  app.use('/', await tenantRouter);
  app.use('/proxy', proxyRouter);

  app.use(
    '/docs',
    function (req, res, next) {
      if (process.env.OAUTH2 === 'true') {
        if (
          process.env.OAUTH2_AUTH_URL !== undefined ||
          process.env.OAUTH2_TOKEN_URL !== undefined
        ) {
          var oauth_config = {
            oauth2_wp: {
              type: 'oauth2',
              description: 'This API uses OAuth 2 with the implicit flow',
              'x-tokenName': 'id_token',
              flows: {
                implicit: {
                  authorizationUrl: process.env.OAUTH2_AUTH_URL,
                  scopes: {
                    openid:
                      "Indicate that the application intends to use OIDC to verify the user's identity",
                  },
                },
              },
            },
          };

          // Protect all paths with openid scope
          var oauth_security = [
            {
              oauth2_wp: ['openid'],
            },
          ];
          workflowManagerSwaggerDocument.security = oauth_security;
          workflowManagerSwaggerDocument.components.securitySchemes =
            oauth_config;
        }
      }

      req.swaggerDoc = workflowManagerSwaggerDocument;

      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(workflowManagerSwaggerDocument),
  );

  app.use(
    '/docs-uniconfig',
    function (req, res, next) {
      if (process.env.UNICONFIG_ZONES_LIST !== undefined) {
        var servers = [];

        process.env.UNICONFIG_ZONES_LIST.split(',').forEach(function (host) {
          servers.push({
            url: '/api/' + host,
            description: 'Frinx APi gateway for zone: ' + host,
          });
        });

        uniconfigSwaggerDocument.servers = servers;
      }

      if (process.env.OAUTH2 === 'true') {
        if (
          process.env.OAUTH2_AUTH_URL !== undefined ||
          process.env.OAUTH2_TOKEN_URL !== undefined
        ) {
          var oauth_config = {
            oauth2_uc: {
              type: 'oauth2',
              description: 'This API uses OAuth 2 with the implicit flow',
              'x-tokenName': 'id_token',
              flows: {
                implicit: {
                  authorizationUrl: process.env.OAUTH2_AUTH_URL,
                  scopes: {
                    openid:
                      "Indicate that the application intends to use OIDC to verify the user's identity",
                  },
                },
              },
            },
          };

          // Protect all paths with openid scope
          var oauth_security = [
            {
              oauth2_uc: ['openid'],
            },
          ];
          uniconfigSwaggerDocument.security = oauth_security;
          uniconfigSwaggerDocument.components.securitySchemes = oauth_config;
        }
      }

      req.swaggerDoc = uniconfigSwaggerDocument;

      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(uniconfigSwaggerDocument),
  );

  app.get('/probe/liveness', (req, res) => {
    res.sendStatus(200);
  });
  app.get('/probe/readiness', (req, res) => {
    res.sendStatus(200);
  });

  const server = app.listen(userFacingPort);
  server.timeout = serverTimeout;
  server.keepAliveTimeout = serverKeepAliveTimeout;
}

init();
