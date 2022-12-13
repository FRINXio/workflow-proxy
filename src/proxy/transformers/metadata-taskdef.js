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
  GLOBAL_PREFIX,
  anythingTo,
  assertAllowedSystemTask,
  createProxyOptionsBuffer,
  getUserEmail,
  withInfixSeparator,
  adminAccess,
} from '../utils.js';

import type { ExpressRequest } from 'express';

import type {
  AfterFun,
  BeforeFun,
  Task,
  TransformerRegistrationFun,
} from '../../types';

// Gets all task definition
/*
curl "localhost/proxy/api/metadata/taskdefs"
*/
const getAllTaskdefsAfter: AfterFun = (identity, req, respObj, res) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to register tasks');
    return;
  }
};

// Create new task definition(s)
// Underscore in name is not allowed.
/*
curl -X POST \
 "localhost/proxy/api/metadata/taskdefs" \
 -H 'Content-Type: application/json' -d '
[
    {
      "name": "bar",
      "retryCount": 3,
      "retryLogic": "FIXED",
      "retryDelaySeconds": 10,
      "timeoutSeconds": 300,
      "timeoutPolicy": "TIME_OUT_WF",
      "responseTimeoutSeconds": 180,
      "ownerEmail": "foo@bar.baz"
    }
]
'
*/
// TODO: should this be disabled?
const postTaskdefsBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to register tasks');
    return;
  }

  // Set owner email
  const reqObj = req.body;
  if (reqObj != null && Array.isArray(reqObj)) {
    for (let idx = 0; idx < reqObj.length; idx++) {
      const taskdef = anythingTo<Task>(reqObj[idx]);
      taskdef.ownerEmail = getUserEmail(req);
    }
    proxyCallback({ buffer: createProxyOptionsBuffer(reqObj, req) });
  } else {
    console.error('Expected req.body to be array in postTaskdefsBefore');
    throw 'Expected req.body to be array in postTaskdefsBefore';
  }
};

// Update an existing task
// Underscore in name is not allowed.
/*
curl -X PUT \
 "localhost/proxy/api/metadata/taskdefs" \
 -H 'Content-Type: application/json' -d '
    {
      "name": "frinx",
      "retryCount": 3,
      "retryLogic": "FIXED",
      "retryDelaySeconds": 10,
      "timeoutSeconds": 400,
      "timeoutPolicy": "TIME_OUT_WF",
      "responseTimeoutSeconds": 180,
      "ownerEmail": "foo@bar.baz"
    }
'
*/
// TODO: should this be disabled?
const putTaskdefBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to register tasks');
    return;
  }

  // Set owner email
  const reqObj = req.body;
  if (reqObj != null && typeof reqObj === 'object') {
    const taskdef = anythingTo<Task>(reqObj);
    taskdef.ownerEmail = getUserEmail(req);
    proxyCallback({ buffer: createProxyOptionsBuffer(reqObj, req) });
  } else {
    console.error('Expected req.body to be object in putTaskdefBefore');
    throw 'Expected req.body to be object in putTaskdefBefore';
  }
};

/*
curl \
 "localhost/proxy/api/metadata/taskdefs/frinx"
*/
// Gets the task definition
const getTaskdefByNameBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to register tasks');
    return;
  }

  proxyCallback();
};

/*
curl \
 "localhost/api/metadata/taskdefs/bar" -X DELETE -v
*/
const deleteTaskdefByNameBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to register tasks');
    return;
  }

  proxyCallback();
};

const registration: TransformerRegistrationFun = () => [
  {
    method: 'get',
    url: '/api/metadata/taskdefs',
    after: getAllTaskdefsAfter,
  },
  {
    method: 'post',
    url: '/api/metadata/taskdefs',
    before: postTaskdefsBefore,
  },
  {
    method: 'put',
    url: '/api/metadata/taskdefs',
    before: putTaskdefBefore,
  },
  {
    method: 'get',
    url: '/api/metadata/taskdefs/:name',
    before: getTaskdefByNameBefore,
  },
  {
    method: 'delete',
    url: '/api/metadata/taskdefs/:name',
    before: deleteTaskdefByNameBefore,
  },
];

export default registration;
