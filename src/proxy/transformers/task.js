/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import request from 'request';
import {
  adminAccess,
  assertAllowedSystemTask,
  createProxyOptionsBuffer,
  removeTenantPrefixes,
  withInfixSeparator
} from '../utils.js';
import type {BeforeFun, TransformerRegistrationFun} from '../../types';
import qs from "qs";

let proxyTarget;

const getLogBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  const url = proxyTarget + '/api/tasks/' + req.params.taskId;
  // first make a HTTP request to validate that this workflow belongs to tenant
  const requestOptions = {
    url,
    method: 'GET',
    headers: {
      'Content-Type': 'application/javascript',
    },
  };
  console.info(`Requesting ${JSON.stringify(requestOptions)}`);
  request(requestOptions, function(error, response, body) {
    console.info(`Got status code: ${response.statusCode}, body: '${body}'`);
    if (response.statusCode === 200) {
      const task = JSON.parse(body);
      // make sure name starts with prefix
      const tenantWithInfixSeparator = withInfixSeparator(identity.tenantId);
      if (task.workflowType?.indexOf(tenantWithInfixSeparator) === 0) {
        proxyCallback();
      } else {
        console.error(
          `Error trying to get task of different tenant: ${identity.tenantId},`,
          {task},
        );
        res.status(401);
        res.send('Unauthorized');
      }
    } else {
      res.status(response.statusCode);
      res.send(body);
    }
  });
};

/*
Result contains task queues of all tenants, keep only belonging to the
tenant's queues.
Sample input:
 {
   "GLOBAL___GRAPHQL_task_go": 0,
   "GLOBAL___RM_claim_task": 0,
   "GLOBAL___RM_free_task": 0,
   "GLOBAL___RM_graphql_task": 0,
   "HTTP": 0,
   "KAFKA_PUBLISH": 0,
   "_deciderQueue": 0,
   "fb-test:GLOBAL___HTTP_task": 0,
   "fb-test:GLOBAL___SAMPLE_task": 0,
   "fb-test:GLOBAL___js": 1,
   "fb-test:GLOBAL___py": 0,
   "secondt:GLOBAL___HTTP_task": 0
 }
*/
const getQueueAllAfter: AfterFun = (identity, req, respObj, res) => {
  if (!adminAccess(identity)) {
    res.status(401);
    res.send('Unauthorized to retrieve queue information');
    return;
  }

  const allowedDomainPrefix = identity.tenantId + ':';
  for (const key in respObj) {
    let newKey = key;
    if (newKey.indexOf(allowedDomainPrefix) === 0) {
      newKey = newKey.substr(allowedDomainPrefix.length);
    }

    if (newKey.indexOf(withInfixSeparator(identity.tenantId)) === 0) {
      newKey = newKey.substr(withInfixSeparator(identity.tenantId).length);
    }

    if (newKey !== key) {
      respObj[newKey] = respObj[key];
      delete respObj[key];
    }
  }
};

const getTasksBatchBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (!adminAccess(identity)) {
    res.status(401);
    res.send('Unauthorized to retrieve tasks');
    return;
  }

  const tenantWithInfixSeparator = withInfixSeparator(identity.tenantId);
  const taskType = tenantWithInfixSeparator + req.params.taskType;
  let newUrl = `/api/tasks/poll/batch/${taskType}`;

  const originalQueryString = req._parsedUrl.query;
  const parsedQuery = qs.parse(originalQueryString);
  let newQuery = "";

  const workerid = parsedQuery['workerid'];
  if (workerid) {
    newQuery += 'workerid=' + workerid;
  }
  const count = parsedQuery['count'];
  if (count) {
    newQuery += '&count=' + count;
  }
  const timeout = parsedQuery['timeout'];
  if (timeout) {
    newQuery += '&timeout=' + count;
  }

  if (newQuery) {
    newQuery += '&domain=' + identity.tenantId;
  } else {
    newQuery += 'domain=' + identity.tenantId;
  }
  newUrl += '?' + newQuery;

  console.info(`Transformed url from '${req.url}' to '${newUrl}'`);
  req.url = newUrl;
  proxyCallback();
};

const getTaskBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (!adminAccess(identity)) {
    res.status(401);
    res.send('Unauthorized to retrieve tasks');
    return;
  }

  const tenantWithInfixSeparator = withInfixSeparator(identity.tenantId);
  const taskType = tenantWithInfixSeparator + req.params.taskType;
  let newUrl = `/api/tasks/poll/${taskType}`;

  const originalQueryString = req._parsedUrl.query;
  const parsedQuery = qs.parse(originalQueryString);
  let newQuery = "";

  const workerid = parsedQuery['workerid'];
  if (workerid) {
    newQuery += 'workerid=' + workerid;
  }

  if (newQuery) {
    newQuery += '&domain=' + identity.tenantId;
  } else {
    newQuery += 'domain=' + identity.tenantId;
  }
  newUrl += '?' + newQuery;

  console.info(`Transformed url from '${req.url}' to '${newUrl}'`);
  req.url = newUrl;
  proxyCallback();
};

const taskJsonPathsToRemovePrefixFrom = {
  'taskType': false,
  'taskDefName': false,
  'workflowTask.name': false,
  'workflowTask.taskDefinition.name': false,
  'workflowType': false
};

const getTasksBatchAfter: AfterFun = (identity, req, respObj) => {
  if (respObj) {
    for (const task of respObj) {
      removeTenantPrefixes(identity.tenantId, task, taskJsonPathsToRemovePrefixFrom);
    }
  }
};

const getTaskAfter: AfterFun = (identity, req, respObj) => {
  if (respObj) {
    removeTenantPrefixes(identity.tenantId, respObj, taskJsonPathsToRemovePrefixFrom);
  }
};

const postTaskBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (!adminAccess(identity)) {
    res.status(401);
    res.send('Unauthorized to update tasks');
    return;
  }

  proxyCallback({buffer: createProxyOptionsBuffer(req.body, req)});
};

const ackTaskBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (!adminAccess(identity)) {
    res.status(401);
    res.send('Unauthorized to ack tasks');
    return;
  }

  proxyCallback();
};

const registration: TransformerRegistrationFun = function(ctx) {
  proxyTarget = ctx.proxyTarget;
  return [
    {
      method: 'get',
      url: '/api/tasks/:taskId/log',
      before: getLogBefore,
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
      after: getTasksBatchAfter,
    },
    {
      method: 'get',
      url: '/api/tasks/poll/:taskType',
      before: getTaskBefore,
      after: getTaskAfter,
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
    }
  ];
};

export default registration;
