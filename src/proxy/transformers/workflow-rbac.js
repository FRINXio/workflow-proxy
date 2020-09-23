/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import {anythingTo, getTenantId, getUserEmail, getUserGroups, getUserRoles} from '../utils.js';
import {
  getExecutionStatusAfter as getExecutionStatusAfterDelegate,
  getSearchAfter as getSearchAfterDelegate,
  getSearchBefore as getSearchBeforeDelegate,
  postWorkflowBefore as postWorkflowBeforeDelegate,
  removeWorkflowBefore as removeWorkflowBeforeDelegate,
  updateQuery,
} from './workflow.js';
import type {AfterFun, BeforeFun, TransformerRegistrationFun, WorkflowExecution,} from '../../types';
import request from 'request';

const postWorkflowBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  postWorkflowBeforeInternal(req, identity, res, proxyCallback,
    (requestOptions, onWorkflowDefCheck) => {
      request(requestOptions, onWorkflowDefCheck);
    });
};

function postWorkflowBeforeInternal(req, identity, res, proxyCallback, checkAndExecute) {
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
      postWorkflowBeforeDelegate(identity, req, res, proxyCallback);
    } else {
      res.status(response.statusCode);
      res.send(body);
    }
  };

  console.info(`Requesting ${JSON.stringify(requestOptions)}`);
  checkAndExecute(requestOptions, workflowDefCheckHandler);
}

export function correlationIdCheck(respObj, req, res) {
  if (respObj.correlationId !== getUserEmail(req)) {
    res.status(401);
    res.send("Unauthorized");
  }
}

const getExecutionStatusAfter: AfterFun = (
  identity,
  req,
  respObj,
  res,
) => {
  getExecutionStatusAfterDelegate(identity, req, respObj, res);
  correlationIdCheck(respObj, req, res);
};

export const removeWorkflowBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  removeWorkflowBeforeInternal(req, identity, res, proxyCallback,
    (requestOptions, onWorkflowDefCheck) => {
      request(requestOptions, onWorkflowDefCheck);
    });
};

function removeWorkflowBeforeInternal(req, identity, res, proxyCallback, checkAndExecute) {
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
      removeWorkflowBeforeDelegate(identity, req, res, proxyCallback);
    } else {
      res.status(response.statusCode);
      res.send(body);
    }
  };

  console.info(`Requesting ${JSON.stringify(requestOptions)}`);
  checkAndExecute(requestOptions, workflowDefCheckHandler);
}

export const getSearchBefore: BeforeFun = (
  identity,
  req,
  res,
  proxyCallback,
) => {
  // Prefix query with correlationId == userEmail
  // This limits the search to workflows started by current user
  const userEmail = getUserEmail(req);
  const originalQueryString = req._parsedUrl.query;
  const limitToTenant = `correlationId = '${userEmail}'`;
  req._parsedUrl.query = updateQuery(originalQueryString, limitToTenant);
  getSearchBeforeDelegate(identity, req, res, proxyCallback);
};

let rbacProxyUrl: string;

const registration: TransformerRegistrationFun = function(ctx) {
  rbacProxyUrl = ctx.rbacProxyUrl;

  return [
    {
      method: 'get',
      url: '/api/workflow/search',
      before: getSearchBefore,
      after: getSearchAfterDelegate,
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

export {postWorkflowBeforeInternal};
export default registration;
