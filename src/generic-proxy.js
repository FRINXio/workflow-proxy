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
import { createProxyOptionsBuffer } from './proxy/utils.js';

import type {
  ExpressRouter,
  ProxyCallback,
  ProxyNext,
  ProxyRequest,
  ProxyResponse,
  TransformerEntry,
} from '../types';

// This simplified proxy allows skipping proxy target altogether with `instead` function.
export default function (
  loggingPrefix: string,
  proxyTarget: string,
  transformers: Array<TransformerEntry>,
) {
  const router = Router<ProxyRequest, ProxyResponse>();
  router.use(bodyParser.urlencoded({ extended: false }));
  router.use('/', bodyParser.json());

  for (const entry of transformers) {
    console.info(
      `${loggingPrefix} Routing url:${entry.url}, method:${entry.method}`,
    );

    // Configure http-proxy per route
    const proxy = httpProxy.createProxyServer({
      selfHandleResponse: true,
      target: proxyTarget,
      // TODO set timeouts
    });

    proxy.on('proxyRes', async function (proxyRes, req, res) {
      console.info(
        `${loggingPrefix} RES ${proxyRes.statusCode} ${req.method} ${req.url}`,
      );
      const body = [];
      proxyRes.on('data', function (chunk) {
        body.push(chunk);
      });
      proxyRes.on('end', function () {
        const data = Buffer.concat(body).toString();
        res.statusCode = proxyRes.statusCode;
        // just resend response without modifying it
        res.end(data);
      });
    });

    (router: ExpressRouter)[entry.method](
      entry.url,
      async (req: ProxyRequest, res: ProxyResponse, next: ProxyNext) => {
        console.info(`${loggingPrefix} REQ ${req.method} ${req.url}`);
        const proxyCallback: ProxyCallback = function (proxyOptions) {
          // FIXME: body-parser does not allow distinguishing between {} and empty body
          // https://github.com/expressjs/body-parser/issues/288
          // sending '{}' does not seem to be harmful.
          if (proxyOptions == undefined && req.body != null) {
            proxyOptions = { buffer: createProxyOptionsBuffer(req.body, req) };
          }
          proxy.web(req, res, proxyOptions, function (e) {
            console.error(`${loggingPrefix} Inline error handler`, e);
            next(e);
          });
        };
        if (entry.instead) {
          try {
            entry.instead(req, res, proxyCallback);
          } catch (err) {
            console.error(
              `${loggingPrefix} Got error in 'instead' function`,
              err,
            );
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
