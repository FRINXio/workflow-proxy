/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import {
  adminAccess,
  anythingTo,
  createProxyOptionsBuffer,
  getUserEmail,
} from '../utils.js';
import { getAllWorkflowsAfter as getAllWorkflowsAfterDelegate } from './metadata-workflowdef.js';

import type { ExpressRequest } from 'express';
import type {
  BeforeFun,
  ScheduleRequest,
  TransformerRegistrationFun,
} from '../../types';

const versionSeparator = ':';
let schellarTarget: string;

// Used in POST and PUT
function sanitizeScheduleBefore(
  schedule: ScheduleRequest,
  req: ExpressRequest,
): void {
  const expectedName =
    schedule.workflowName + versionSeparator + schedule.workflowVersion;
  if (schedule.name !== expectedName) {
    console.error('Unexpected schedule name', { schedule, expectedName });
    throw 'Unexpected schedule name';
  }
  if (expectedName.indexOf('/') > -1) {
    // guard against https://github.com/flaviostutz/schellar/issues/4
    console.error('Cannot create schedule with name containing "/" character');
    throw 'Cannot create schedule with name containing "/" character';
  }

  // Whoever creates/updates the schedule will be presented to workers as the owner of the execution.
  schedule.correlationId = getUserEmail(req); // TODO: include roles and groups
}

/*
curl http://localhost/proxy/schedule \
  -H 'Content-Type: application/json'
*/
const getAllBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to schedule workflows');
    return;
  }

  req.url = '/schedule';
  proxyCallback({ target: schellarTarget });
};

/*
curl http://localhost/proxy/schedule/workflow1 \
  -H 'Content-Type: application/json'
*/
const getBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to schedule workflows');
    return;
  }

  proxyCallback({ target: schellarTarget });
};

/*
curl -X POST http://localhost/proxy/schedule \
  -H 'Content-Type: application/json' \
  -d '
  {
  "name": "workflow1:1",
  "enabled": true,
  "parallelRuns": false,
  "workflowName": "workflow1",
  "workflowVersion": "1",
  "cronString": "0 * * ? * *",
  "workflowContext": {
    "param1": "value1",
    "param2": "value2"
  },
  "fromDate": "2019-01-01T15:04:05Z",
  "toDate": "2029-07-01T15:04:05Z"
  }
'
*/
const postBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to schedule workflows');
    return;
  }

  req.url = '/schedule';
  const schedule = anythingTo<ScheduleRequest>(req.body);
  sanitizeScheduleBefore(schedule, req);
  const buffer = createProxyOptionsBuffer(schedule, req);
  proxyCallback({ target: schellarTarget, buffer });
};

/*
curl -X PUT http://localhost/proxy/schedule/workflow1 \
  -H 'Content-Type: application/json' \
  -d '
  {
  "name": "workflow1:1",
  "enabled": true,
  "parallelRuns": false,
  "workflowName": "workflow1",
  "workflowVersion": "1",
  "cronString": "0 * * ? * *",
  "workflowContext": {
    "param1": "value1",
    "param2": "value2"
  },
  "fromDate": "2019-01-01T15:04:05Z",
  "toDate": "2029-07-01T15:04:05Z"
  }
'
*/
// Renaming is not supported by proxy - url name must be equal to workflowName
const putBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to schedule workflows');
    return;
  }

  const schedule = anythingTo<ScheduleRequest>(req.body);
  let reqName = req.params.name;
  if (reqName !== schedule.name) {
    console.error('Schedule name must be equal to name supplied in url', {
      schedule,
      reqName,
    });
    // TODO create Exception class
    throw 'Schedule name must be equal to name supplied in url';
  }
  sanitizeScheduleBefore(schedule, req);
  reqName = schedule.name;
  req.url = '/schedule/' + reqName;
  const buffer = createProxyOptionsBuffer(schedule, req);
  proxyCallback({ target: schellarTarget, buffer });
};

/*
curl -X DELETE \
  -H 'Content-Type: application/json' \
  http://localhost/proxy/schedule/workflow1
*/
const deleteBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to schedule workflows');
    return;
  }

  proxyCallback({ target: schellarTarget });
};

const registration: TransformerRegistrationFun = function (ctx) {
  schellarTarget = ctx.schellarTarget;
  return [
    {
      method: 'get',
      url: '/schedule/?',
      before: getAllBefore,
    },
    {
      method: 'get',
      url: '/schedule/:name',
      before: getBefore,
    },
    {
      method: 'post',
      url: '/schedule/?',
      before: postBefore,
    },
    {
      method: 'put',
      url: '/schedule/:name',
      before: putBefore,
    },
    {
      method: 'delete',
      url: '/schedule/:name',
      before: deleteBefore,
    },
    {
      method: 'get',
      url: '/schedule/metadata/workflow',
      after: getAllWorkflowsAfterDelegate,
    },
  ];
};

export default registration;
