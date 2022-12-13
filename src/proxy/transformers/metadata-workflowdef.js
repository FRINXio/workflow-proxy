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
  adminAccess,
  anythingTo,
  isLabeledWithGroup,
  isLabeledWithRole,
  getUserEmail,
  createProxyOptionsBuffer,
} from '../utils.js';
import type {
  AfterFun,
  BeforeFun,
  TransformerRegistrationFun,
  Workflow,
} from '../../types';

// Retrieves all workflow definition along with blueprint
/*
curl"localhost/proxy/api/metadata/workflow"
*/
export const getAllWorkflowsAfter: AfterFun = (identity, req, respObj) => {
  const workflows: Array<Workflow> = anythingTo<Array<Workflow>>(respObj);
  // iterate over workflows, keep only those available to the user
  for (
    let workflowIdx = workflows.length - 1;
    workflowIdx >= 0;
    workflowIdx--
  ) {
    /* Rbac (non admin) limitations */
    // Remove workflows outside of user's groups
    const workflowdef = workflows[workflowIdx];
    if (
      !adminAccess(identity) &&
      !isLabeledWithGroup(workflowdef, identity.groups) &&
      !isLabeledWithRole(workflowdef, identity.roles)
    ) {
      workflows.splice(workflowIdx, 1);
    }
  }
};

// Removes workflow definition. It does not remove workflows associated
// with the definition.
// Version is passed as url parameter.
/*
curl \
  "localhost/proxy/api/metadata/workflow/2/2" -X DELETE
*/
const deleteWorkflowBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to remove a workflow');
    return;
  }

  proxyCallback();
};

export const getWorkflowAfter: AfterFun = (identity, req, respObj, res) => {
  const workflow = anythingTo<Workflow>(respObj);

  /* Rbac (non admin) limitations */
  if (
    !adminAccess(identity) &&
    !isLabeledWithGroup(workflow, identity.groups) &&
    !isLabeledWithRole(workflow, identity.roles)
  ) {
    // fail if workflow is outside of user's groups
    console.error(`User accessing unauthorized workflow: ${workflow.name}`);
    res.status(427).send('User unauthorized to access this endpoint');
  }
};

// Create or update workflow definition
// Underscore in name is not allowed.
/*
curl -X PUT \
  "localhost/proxy/api/metadata/workflow" \
  -H 'Content-Type: application/json' -d '
[
    {
    "name": "fx3",
    "description": "foo1",
    "ownerEmail": "foo@bar.baz",
    "version": 1,
    "schemaVersion": 2,
    "tasks": [
        {
        "name": "bar",
        "taskReferenceName": "barref",
        "type": "SIMPLE",
        "inputParameters": {}
        }
    ]
    }
]'


curl -X PUT \
  "localhost/proxy/api/metadata/workflow" \
  -H 'Content-Type: application/json' -d '
[
    {
    "name": "fx3",
    "description": "foo1",
    "ownerEmail": "foo@bar.baz",
    "version": 1,
    "schemaVersion": 2,
    "tasks": [
        {
        "name": "bar",
        "taskReferenceName": "barref",
        "type": "SIMPLE",
        "inputParameters": {}
        },
        {
        "name": "GLOBAL___js",
        "taskReferenceName": "globref",
        "type": "SIMPLE",
        "inputParameters": {}
        }
    ]
    }
]'
*/
const putWorkflowBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to create a workflow');
    return;
  }
  const workflows: Array<Workflow> = anythingTo<Array<Workflow>>(req.body);
  for (const workflowdef of workflows) {
    workflowdef.ownerEmail = getUserEmail(req);
  }
  proxyCallback({ buffer: createProxyOptionsBuffer(workflows, req) });
};

// Create a new workflow definition
// Underscore in name is not allowed.
/*
curl -X POST \
  "localhost/proxy/api/metadata/workflow" \
  -H 'Content-Type: application/json' -d '

    {
    "name": "fx3",
    "description": "foo1",
    "ownerEmail": "foo@bar.baz",
    "version": 1,
    "schemaVersion": 2,
    "tasks": [
        {
        "name": "bar",
        "taskReferenceName": "barref",
        "type": "SIMPLE",
        "inputParameters": {}
        },
        {
        "name": "GLOBAL_GLOBAL1",
        "taskReferenceName": "globref",
        "type": "SIMPLE",
        "inputParameters": {}
        }
    ]
    }
'
*/
const postWorkflowBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (!adminAccess(identity)) {
    res.status(427);
    res.send('Unauthorized to create a workflow');
    return;
  }
  const workflow: Workflow = anythingTo<Workflow>(req.body);
  workflow.ownerEmail = getUserEmail(req);

  proxyCallback({ buffer: createProxyOptionsBuffer(workflow, req) });
};

const registration: TransformerRegistrationFun = () => [
  {
    method: 'get',
    url: '/api/metadata/workflow',
    after: getAllWorkflowsAfter,
  },
  {
    method: 'delete',
    url: '/api/metadata/workflow/:name/:version',
    before: deleteWorkflowBefore,
  },
  {
    method: 'get',
    url: '/api/metadata/workflow/:name',
    after: getWorkflowAfter,
  },
  {
    method: 'put',
    url: '/api/metadata/workflow',
    before: putWorkflowBefore,
  },
  {
    method: 'post',
    url: '/api/metadata/workflow',
    before: postWorkflowBefore,
  },
];

export default registration;
