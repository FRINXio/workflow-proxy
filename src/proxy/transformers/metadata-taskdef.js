/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

// Currently just filters result without passing prefix to conductor.
// TODO: implement querying by prefix in conductor
import {
  GLOBAL_PREFIX,
  addTenantIdPrefix,
  anythingTo,
  assertAllowedSystemTask,
  createProxyOptionsBuffer,
  getUserEmail,
  removeTenantPrefix,
  withInfixSeparator, adminAccess,
} from '../utils.js';

import type {ExpressRequest} from 'express';

import type {
  AfterFun,
  BeforeFun,
  Task,
  TransformerRegistrationFun,
} from '../../types';

// Gets all task definition
/*
curl  -H "x-tenant-id: fb-test" "localhost/proxy/api/metadata/taskdefs"
*/
const getAllTaskdefsAfter: AfterFun = (identity, req, respObj, res) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to register tasks');
    return;
  }

  const tasks = anythingTo<Array<Task>>(respObj);
  // iterate over taskdefs, keep only those belonging to tenantId or global
  const tenantWithInfixSeparator = withInfixSeparator(identity.tenantId);
  const globalPrefix = withInfixSeparator(GLOBAL_PREFIX);

  for (let idx = tasks.length - 1; idx >= 0; idx--) {
    const taskdef = tasks[idx];
    if (
      taskdef.name.indexOf(tenantWithInfixSeparator) !== 0 &&
      taskdef.name.indexOf(globalPrefix) !== 0
    ) {
      // remove element
      tasks.splice(idx, 1);
    }
  }
  // remove tenantId prefix
  removeTenantPrefix(identity.tenantId, tasks, '$[*].name', true);
};

// Used in POST and PUT
function sanitizeTaskdefBefore(tenantId: string, taskdef: Task, req: ExpressRequest): void {
  // only whitelisted system tasks are allowed
  assertAllowedSystemTask(taskdef);
  // prepend tenantId
  addTenantIdPrefix(tenantId, taskdef);

  taskdef.ownerEmail = getUserEmail(req);
}
// Create new task definition(s)
// Underscore in name is not allowed.
/*
curl -X POST -H "x-tenant-id: fb-test"  \
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
const postTaskdefsBefore: BeforeFun = (
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

  // iterate over taskdefs, prefix with tenantId
  const reqObj = req.body;
  if (reqObj != null && Array.isArray(reqObj)) {
    for (let idx = 0; idx < reqObj.length; idx++) {
      const taskdef = anythingTo<Task>(reqObj[idx]);
      sanitizeTaskdefBefore(identity.tenantId, taskdef, req);
    }
    proxyCallback({buffer: createProxyOptionsBuffer(reqObj, req)});
  } else {
    console.error('Expected req.body to be array in postTaskdefsBefore');
    throw 'Expected req.body to be array in postTaskdefsBefore';
  }
};

// Update an existing task
// Underscore in name is not allowed.
/*
curl -X PUT -H "x-tenant-id: fb-test" \
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
const putTaskdefBefore: BeforeFun = (
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

  const reqObj = req.body;
  if (reqObj != null && typeof reqObj === 'object') {
    const taskdef = anythingTo<Task>(reqObj);
    sanitizeTaskdefBefore(identity.tenantId, taskdef, req);
    proxyCallback({buffer: createProxyOptionsBuffer(reqObj, req)});
  } else {
    console.error('Expected req.body to be object in putTaskdefBefore');
    throw 'Expected req.body to be object in putTaskdefBefore';
  }
};

/*
curl -H "x-tenant-id: fb-test" \
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

  const globalPrefix = withInfixSeparator(GLOBAL_PREFIX);
  if (req.params.name.indexOf(globalPrefix) !== 0) {
    req.params.name = withInfixSeparator(identity.tenantId) + req.params.name;
    // modify url
    req.url = '/api/metadata/taskdefs/' + req.params.name;
  }
  proxyCallback();
};

const getTaskdefByNameAfter: AfterFun = (
  identity,
  req,
  respObj,
  res,
) => {
  const task = anythingTo<Task>(respObj);
  const globalPrefix = withInfixSeparator(GLOBAL_PREFIX);
  const tenantWithInfixSeparator = withInfixSeparator(identity.tenantId);
  // remove prefix
  if (task.name.indexOf(tenantWithInfixSeparator) === 0) {
    task.name = task.name.substr(tenantWithInfixSeparator.length);
  } else if (task.name.indexOf(globalPrefix) !== 0) {
    console.error(
      `Tenant Id prefix '${identity.tenantId}' not found, taskdef name: '${task.name}'`,
    );
    res.status(400);
    res.send('Prefix not found');
  }
};

// TODO: can this be disabled?
// Remove a task definition
/*
curl -H "x-tenant-id: fb-test" \
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

  req.params.name = withInfixSeparator(identity.tenantId) + req.params.name;
  // modify url
  req.url = '/api/metadata/taskdefs/' + req.params.name;
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
    after: getTaskdefByNameAfter,
  },
  {
    method: 'delete',
    url: '/api/metadata/taskdefs/:name',
    before: deleteTaskdefByNameBefore,
  },
];

export default registration;
