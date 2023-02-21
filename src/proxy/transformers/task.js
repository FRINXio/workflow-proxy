/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import { adminAccess, createProxyOptionsBuffer } from '../utils.js';
import type {
  AfterFun,
  BeforeFun,
  TransformerRegistrationFun,
} from '../../types';

let proxyTarget;

const getQueueAllAfter: AfterFun = (identity, req, respObj, res) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to retrieve queue information');
    return;
  }
};

const getTasksBatchBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to retrieve tasks');
    return;
  }

  proxyCallback();
};

const getTaskBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to retrieve tasks');
    return;
  }

  proxyCallback();
};

const postTaskBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to update tasks');
    return;
  }

  proxyCallback({ buffer: createProxyOptionsBuffer(req.body, req) });
};

const ackTaskBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to ack tasks');
    return;
  }

  proxyCallback();
};

const registration: TransformerRegistrationFun = function (ctx) {
  proxyTarget = ctx.proxyTarget;
  return [
    {
      method: 'get',
      url: '/api/tasks/:taskId/log',
    },
    {
      method: 'get',
      url: '/api/tasks/queue/all',
      after: getQueueAllAfter,
    },
    {
      method: 'get',
      url: '/api/tasks/poll/batch/:taskType',
      before: getTasksBatchBefore,
    },
    {
      method: 'get',
      url: '/api/tasks/poll/:taskType',
      before: getTaskBefore,
    },
    {
      method: 'post',
      url: '/api/tasks',
      before: postTaskBefore,
    },
    {
      method: 'post',
      url: '/api/tasks/:taskId/ack',
      before: ackTaskBefore,
    },
    {
      method: 'get',
      url: '/api/tasks/externalstoragelocation',
    },
  ];
};

export default registration;
