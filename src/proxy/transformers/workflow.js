/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import qs from 'qs';
import request from 'request';
import {
  addTenantIdPrefix, adminAccess,
  anythingTo,
  createProxyOptionsBuffer, getTenantId, getUserEmail, getUserGroups, getUserRoles,
  removeTenantPrefix,
  removeTenantPrefixes,
  withInfixSeparator,
} from '../utils.js';

import type {
  AfterFun,
  BeforeFun,
  StartWorkflowRequest,
  TransformerRegistrationFun, WorkflowExecution,
} from '../../types';

// Search for workflows based on payload and other parameters
/*
 curl -H "x-tenant-id: fb-test" \
  "localhost/proxy/api/workflow/search?query=status+IN+(FAILED)"
*/
export const getSearchBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  const originalQueryString = req._parsedUrl.query;
  let newQueryString = originalQueryString;

  /* Rbac (non admin) limitations */
  if (!adminAccess(identity)) {
    // Prefix query with correlationId == userEmail
    // This limits the search to workflows started by current user
    const userEmail = getUserEmail(req);
    const limitToUser = `correlationId = '${userEmail}'`;
    newQueryString = updateQuery(newQueryString, limitToUser);
  }

  /* Tenant limitations */
  // prefix query with workflowType STARTS_WITH tenantId_
  const limitToTenant = `workflowType STARTS_WITH '${identity.tenantId}_'`;
  newQueryString = updateQuery(newQueryString, limitToTenant);

  req.url = req._parsedUrl.pathname + '?' + newQueryString;
  proxyCallback();
};

export const getSearchAfter: AfterFun = (identity, req, respObj) => {
  removeTenantPrefix(identity.tenantId, respObj, 'results[*].workflowType', false);
};

export function updateQuery(
  originalQueryString: string,
  queryExpanded: string,
): string {
  const parsedQuery = qs.parse(originalQueryString);
  let q = parsedQuery['query'];
  if (q) {
    // TODO: validate conductor query to prevent security issues
    q = `(${q} AND (${queryExpanded}))`;
  } else {
    q = `(${queryExpanded})`;
  }
  parsedQuery['query'] = q;
  const newQueryString = qs.stringify(parsedQuery);
  console.info(
    `Transformed query string from ` +
      `'${originalQueryString}' to '${newQueryString}`,
  );
  return newQueryString;
}

// Start a new workflow with StartWorkflowRequest, which allows task to be
// executed in a domain
/*
curl -X POST -H "x-tenant-id: fb-test" -H \
"Content-Type: application/json" "localhost/proxy/api/workflow" -d '
{
  "name": "fx3",
  "version": 1,
  "correlatonId": "corr1",
  "ownerApp": "my_owner_app",
  "input": {
  }
}
'
*/
export const postWorkflowBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (adminAccess(identity)) {
    postWorkflowBeforeTenant(identity, req, res, proxyCallback);
  } else {
    postWorkflowBeforeRbac(identity, req, res, proxyCallback,
      (requestOptions, onWorkflowDefCheck) => {
        request(requestOptions, onWorkflowDefCheck);
      });
  }
};

const postWorkflowBeforeTenant: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  const reqObj = anythingTo<StartWorkflowRequest>(req.body);

  // workflowDef section is not allowed (no dynamic workflows)
  if (reqObj.workflowDef != null) {
    console.error(
      `Section workflowDef is not allowed ${JSON.stringify(reqObj)}`,
    );
    throw 'Section workflowDef is not allowed';
  }
  // taskToDomain section is not allowed
  if (reqObj.taskToDomain) {
    console.error(
      `Section taskToDomain is not allowed ${JSON.stringify(reqObj)}`,
    );
    throw 'Section taskToDomain is not allowed';
  }

  // add prefix
  addTenantIdPrefix(identity.tenantId, reqObj);
  // add taskToDomain
  reqObj.taskToDomain = {};
  // Put userEmail into correlationId
  reqObj.correlationId = getUserEmail(req);
  reqObj.taskToDomain['*'] = identity.tenantId;
  console.info(`Transformed request to ${JSON.stringify(reqObj)}`);
  proxyCallback({buffer: createProxyOptionsBuffer(reqObj, req)});
};

export function postWorkflowBeforeRbac(req, identity, res, proxyCallback, checkAndExecute) {
  const workflow: WorkflowExecution = anythingTo<WorkflowExecution>(req.body);
  let url = rbacProxyUrl + 'api/metadata/workflow/' + workflow.name;
  if (workflow.version) {
    url += '?version=' + workflow.version;
  }
  // first make an HTTP request to validate that this workflow belongs to the right group
  // by calling GET on workflow definition (that has checks built-in)
  const requestOptions = {
    url,
    method: 'GET',
    headers: {
      'from': getUserEmail(req),
      'x-tenant-id': getTenantId(req),
      'x-auth-user-roles': getUserRoles(req),
      'x-auth-user-groups': getUserGroups(req),
    },
  };

  let workflowDefCheckHandler = async (error, response, body) => {
    if (error) {
      console.error(error);
      res.status(500);
      res.send('Unable to authorize user access');
      return;
    }

    // authorize workflow def access
    console.info(`Got status code: ${response.statusCode}, body: '${body}'`);
    if (response.statusCode === 200) {
      // Workflow def can be accessed via RBAC proxy, meaning we are authorized
      postWorkflowBeforeTenant(identity, req, res, proxyCallback);
    } else {
      res.status(response.statusCode);
      res.send(body);
    }
  };

  console.info(`Requesting ${JSON.stringify(requestOptions)}`);
  checkAndExecute(requestOptions, workflowDefCheckHandler);
}

// Gets the workflow by workflow id
/*
curl  -H "x-tenant-id: fb-test" \
    "localhost/proxy/api/workflow/c0a438d4-25b7-4c12-8a29-3473d98b1ad7"
*/
export const getExecutionStatusAfter: AfterFun = (
  identity,
  req,
  respObj,
  res,
) => {

  if (!adminAccess(identity)) {
    correlationIdCheck(respObj, req, res);
  }

  const jsonPathToAllowGlobal = {
    workflowName: false,
    workflowType: false,
    'tasks[*].taskDefName': true,
    'tasks[*].workflowTask.name': true,
    'tasks[*].workflowTask.taskDefinition.name': true,
    'tasks[*].inputData.subWorkflowName': false,
    'tasks[*].workflowType': false,
    'tasks[*].outputData.workflowType': false,
    'tasks[*].workflowTask.subWorkflowParam.name': false,
    'output.workflowType': false,
    'workflowDefinition.name': false,
    'workflowDefinition.tasks[*].name': true,
    'workflowDefinition.tasks[*].taskDefinition.name': true,
    'workflowDefinition.tasks[*].subWorkflowParam.name': false,
  };
  removeTenantPrefixes(identity.tenantId, respObj, jsonPathToAllowGlobal);
};

export function correlationIdCheck(respObj, req, res) {
  if (respObj.correlationId !== getUserEmail(req)) {
    res.status(401);
    res.send("Unauthorized");
  }
}

// Removes the workflow from the system
/*
curl  -H "x-tenant-id: fb-test" \
    "localhost/proxy/api/workflow/2dbb6e3e-c45d-464b-a9c9-2bbb16b7ca71/remove" \
    -X DELETE
*/
const removeWorkflowBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (adminAccess(identity)) {
    removeWorkflowBeforeTenant(identity, req, res, proxyCallback);
  } else {
    removeWorkflowBeforeRbac(identity, req, res, proxyCallback,
      (requestOptions, onWorkflowDefCheck) => {
        request(requestOptions, onWorkflowDefCheck);
      });
  }
};

const removeWorkflowBeforeTenant: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  const url = proxyTarget + '/api/workflow/' + req.params.workflowId;
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
      const workflow = JSON.parse(body);
      // make sure name starts with prefix
      const tenantWithInfixSeparator = withInfixSeparator(identity.tenantId);
      if (workflow.workflowName.indexOf(tenantWithInfixSeparator) === 0) {
        proxyCallback();
      } else {
        console.error(
          `Error trying to delete workflow of different tenant: ${identity.tenantId},` +
            ` workflow: ${JSON.stringify(workflow)}`,
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

function removeWorkflowBeforeRbac(req, identity, res, proxyCallback, checkAndExecute) {
  let url = rbacProxyUrl + 'api/workflow/' + req.params.workflowId;
  const requestOptions = {
    url,
    method: 'GET',
    headers: {
      'from': getUserEmail(req),
      'x-tenant-id': getTenantId(req)
    },
  };

  let workflowDefCheckHandler = async (error, response, body) => {
    if (error) {
      console.error(error);
      res.status(500);
      res.send('Unable to authorize user access');
      return;
    }

    // authorize workflow def access
    console.info(`Got status code: ${response.statusCode}, body: '${body}'`);
    if (response.statusCode === 200) {
      // Workflow execution can be accessed via RBAC proxy, meaning we are authorized
      removeWorkflowBeforeTenant(identity, req, res, proxyCallback);
    } else {
      res.status(response.statusCode);
      res.send(body);
    }
  };

  console.info(`Requesting ${JSON.stringify(requestOptions)}`);
  checkAndExecute(requestOptions, workflowDefCheckHandler);
}

let proxyTarget: string;
let rbacProxyUrl: string;

const registration: TransformerRegistrationFun = function(ctx) {
  proxyTarget = ctx.proxyTarget;
  rbacProxyUrl = ctx.rbacProxyUrl;

  return [
    {
      method: 'get',
      url: '/api/workflow/search',
      before: getSearchBefore,
      after: getSearchAfter,
    },
    {
      method: 'post',
      url: '/api/workflow',
      before: postWorkflowBefore,
    },
    {
      method: 'get',
      url: '/api/workflow/:workflowId',
      after: getExecutionStatusAfter,
    },
    {
      method: 'delete',
      url: '/api/workflow/:workflowId/remove',
      before: removeWorkflowBefore,
    },
  ];
};

export default registration;
