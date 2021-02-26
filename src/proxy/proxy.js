/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */
import Router from 'express';
import bodyParser from 'body-parser';
import httpProxy from 'http-proxy';

import transformerRegistry from './transformer-registry';
import {getTenantId, getUserGroups, getUserRoles} from './utils.js';
import type {
  AuthorizationCheck,
  ExpressRouter,
  GroupLoadingStrategy,
  RoleLoadingStrategy,
  ProxyCallback,
  ProxyNext,
  ProxyRequest,
  ProxyResponse,
  TransformerRegistrationFun, IdentityHeaders,
} from '../types';

export default async function(
  proxyTarget: string,
  tenantProxyUrl: string,
  schellarTarget: string,
  transformFx: Array<TransformerRegistrationFun>,
) {
  const router = Router<ProxyRequest, ProxyResponse>();
  router.use(bodyParser.urlencoded({extended: false}));
  router.use('/', bodyParser.json());

  const transformers = await transformerRegistry(
    {
      proxyTarget,
      tenantProxyUrl,
      schellarTarget,
    },
    transformFx,
  );

  for (const entry of transformers) {
    console.info(`Routing url:${entry.url}, method:${entry.method}`);

    // Configure http-proxy per route
    const proxy = httpProxy.createProxyServer({
      selfHandleResponse: true,
      target: proxyTarget,
      // TODO set timeouts
    });

    proxy.on('proxyRes', async function(proxyRes, req, res) {
      const tenantId = getTenantId(req);
      const roles = getUserRoles(req);
      const groups = getUserGroups(req);
      const identity: IdentityHeaders = {tenantId, roles, groups};

      console.info(
        `RES ${proxyRes.statusCode} ${req.method} ${req.url} tenantId ${tenantId}`,
      );
      const body = [];
      proxyRes.on('data', function(chunk) {
        body.push(chunk);
      });
      proxyRes.on('end', function() {
        const data = Buffer.concat(body).toString();
        res.statusCode = proxyRes.statusCode;
        if (
          proxyRes.statusCode >= 200 &&
          proxyRes.statusCode < 300 &&
          entry.after
        ) {
          let respObj = null;
          try {
            // conductor does not always send correct
            // Content-Type, e.g. on 404
            respObj = JSON.parse(data);
          } catch (e) {
            console.warn('Response is not JSON');
          }
          try {
            entry.after(identity, req, respObj, res);
            res.end(JSON.stringify(respObj));
          } catch (e) {
            console.error('Error while modifying response', {error: e});
            res.end('Internal server error');
            throw e;
          }
        } else {
          // just resend response without modifying it
          res.end(data);
        }
      });
    });

    (router: ExpressRouter)[entry.method](
      entry.url,
      async (req: ProxyRequest, res: ProxyResponse, next: ProxyNext) => {
        let tenantId: string;
        let roles: string;
        let groups: string[];
        let identity: IdentityHeaders;
        try {
          tenantId = getTenantId(req);
          roles = getUserRoles(req);
          groups = getUserGroups(req);
          identity = {tenantId, roles, groups};
        } catch (err) {
          console.error('Cannot get tenantId', {tenantId, roles, groups}, err);
          res.status(400);
          res.send('Cannot get tenantId:' + err);
          return;
        }
        // start with 'before'
        console.info(`REQ ${req.method} ${req.url} tenantId ${tenantId}`);
        const proxyCallback: ProxyCallback = function(proxyOptions) {
          proxy.web(req, res, proxyOptions, function(e) {
            console.error('Inline error handler', e);
            next(e);
          });
        };
        if (entry.before) {
          try {
            entry.before(identity, req, res, proxyCallback);
          } catch (err) {
            console.error('Got error in beforeFun', err);
            res.status(500);
            res.send('Cannot send request: ' + err);
            return;
          }
        } else {
          proxyCallback();
        }
      },
    );
  }

  return router;
}
