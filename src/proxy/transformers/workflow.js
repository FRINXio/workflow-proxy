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
  adminAccess,
  anythingTo,
  createProxyOptionsBuffer,
  getUserEmail,
  getUserGroups,
  getUserRoles,
} from '../utils.js';

import type {
  AfterFun,
  BeforeFun,
  StartWorkflowRequest,
  TransformerRegistrationFun,
  WorkflowExecution,
} from '../../types';

export const getRunningBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  // No RBAC required, this is just list of IDs, no need to filter them
  proxyCallback();
};

export const getPathBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  // No RBAC required, this is just list of IDs, no need to filter them
  proxyCallback();
};

export const getFamilyBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  if (!adminAccess(identity)) {
    // TODO implement RBAC ? does it make sense for non admins to call this ?
    res.status(427);
    res.send('Unauthorized');
  }

  proxyCallback();
};

// Search for workflows based on payload and other parameters
/*
 curl \
  "localhost/proxy/api/workflow/search?query=status+IN+(FAILED)"
*/
export const getSearchBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  let newQueryString = req._parsedUrl.query;

  /* Rbac (non admin) limitations */
  if (!adminAccess(identity)) {
    // Prefix query with correlationId == userEmail
    // This limits the search to workflows started by current user
    const userEmail = getUserEmail(req);
    const limitToUser = `correlationId='${userEmail}'`;
    newQueryString = updateQuery(newQueryString, limitToUser);
  }

  req.url = `${req._parsedUrl.pathname}?${newQueryString}`;
  proxyCallback();
};

export function updateQuery(
  originalQueryString: string,
  queryExpanded: string,
): string {
  const parsedQuery = qs.parse(originalQueryString);
  let q = parsedQuery['query'];
  if (q) {
    // TODO: validate conductor query to prevent security issues
    q = `${q} AND ${queryExpanded}`;
  } else {
    q = `${queryExpanded}`;
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
export function postWorkflowBeforeInternal(
  identity,
  proxyCallback,
  req,
  res,
  requestExecutor,
) {
  if (adminAccess(identity)) {
    proxyCallback();
  }

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
      from: getUserEmail(req),
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
      // Put userEmail into correlationId and execute
      const reqObj = anythingTo<StartWorkflowRequest>(req.body);
      reqObj.correlationId = getUserEmail(req);
      proxyCallback({ buffer: createProxyOptionsBuffer(reqObj, req) });
    } else {
      res.status(response.statusCode);
      res.send(body);
    }
  };

  console.info(`Requesting ${JSON.stringify(requestOptions)}`);
  requestExecutor(requestOptions, workflowDefCheckHandler);
}

/*
curl -X POST -H \
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
  postWorkflowBeforeInternal(
    identity,
    proxyCallback,
    req,
    res,
    (requestOptions, onWorkflowDefCheck) => {
      request(requestOptions, onWorkflowDefCheck);
    },
  );
};

// Gets the workflow by workflow id
/*
curl \
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
};

export function correlationIdCheck(respObj, req, res) {
  if (respObj.correlationId !== getUserEmail(req)) {
    res.status(427);
    res.send('Unauthorized');
  }
}

// Removes the workflow from the system
/*
curl \
    "localhost/proxy/api/workflow/2dbb6e3e-c45d-464b-a9c9-2bbb16b7ca71/remove" \
    -X DELETE
*/
const removeWorkflowBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  if (adminAccess(identity)) {
    proxyCallback();
  }

  let url = rbacProxyUrl + 'api/workflow/' + req.params.workflowId;
  const requestOptions = {
    url,
    method: 'GET',
    headers: {
      from: getUserEmail(req),
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
      proxyCallback();
    } else {
      res.status(response.statusCode);
      res.send(body);
    }
  };

  console.info(`Requesting ${JSON.stringify(requestOptions)}`);
  request(requestOptions, workflowDefCheckHandler);
};

let proxyTarget: string;
let rbacProxyUrl: string;

const registration: TransformerRegistrationFun = function (ctx) {
  proxyTarget = ctx.proxyTarget;
  rbacProxyUrl = ctx.tenantProxyUrl;

  return [
    {
      method: 'get',
      url: '/api/workflow/search',
      before: getSearchBefore,
    },
    {
      method: 'get',
      url: '/api/workflow/running/:workflowType',
      before: getRunningBefore,
    },
    {
      method: 'get',
      url: '/api/workflow/path/:workflowId',
      before: getPathBefore,
    },
    {
      method: 'get',
      url: '/api/workflow/family/:workflowId',
      before: getFamilyBefore,
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
