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
import {withInfixSeparator} from '../utils.js';
import type {BeforeFun, TransformerRegistrationFun} from '../../types';

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
    if (response.statusCode == 200) {
      const task = JSON.parse(body);
      // make sure name starts with prefix
      const tenantWithInfixSeparator = withInfixSeparator(identity.tenantId);
      if (task.workflowType?.indexOf(tenantWithInfixSeparator) == 0) {
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
const getQueueAllAfter: AfterFun = (identity, req, respObj) => {
  const allowedDomainPrefix = identity.tenantId + ':';
  for (const key in respObj) {
    if (key.indexOf(allowedDomainPrefix) == 0) {
      respObj[key.substr(allowedDomainPrefix.length)] = respObj[key];
    }
    delete respObj[key];
  }
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
  ];
};

export default registration;
