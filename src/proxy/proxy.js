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
import {getTenantId, getUserGroups, getUserRole} from './utils.js';
import type {
  AuthorizationCheck,
  ExpressRouter,
  GroupLoadingStrategy,
  ProxyCallback,
  ProxyNext,
  ProxyRequest,
  ProxyResponse,
  TransformerRegistrationFun,
} from '../types';

export default async function(
  proxyTarget: string,
  schellarTarget: string,
  transformFx: Array<TransformerRegistrationFun>,
  authorizationCheck: AuthorizationCheck,
  groupLoadingStrategy: GroupLoadingStrategy,
) {
  const router = Router<ProxyRequest, ProxyResponse>();
  router.use(bodyParser.urlencoded({extended: false}));
  router.use('/', bodyParser.json());

  const transformers = await transformerRegistry(
    {
      proxyTarget,
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
      const role = getUserRole(req);
      const groups = await getUserGroups(req, groupLoadingStrategy);

      if (!authorizationCheck(role, groups)) {
        res.status(401);
        res.send('User unauthorized to access this endpoint');
        return;
      }

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
            entry.after(tenantId, groups, req, respObj, res);
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
        let groups: string[];
        try {
          tenantId = getTenantId(req);
          groups = await getUserGroups(req, groupLoadingStrategy);
        } catch (err) {
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
            entry.before(tenantId, groups, req, res, proxyCallback);
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
