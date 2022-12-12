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
  createProxyOptionsBuffer,
  findValuesByJsonPath,
  removeTenantPrefix,
} from '../utils';

import type { BeforeFun, TransformerRegistrationFun } from '../../types';

// All bulk operations expect json array of workflow Ids in request.
// Each workflow Id must belong to current tenant. Search api is
// used to get all metadata in a single request. If there are no
// validation issues, request is passed to the proxy target.
/*
curl  -H "x-tenant-id: fb-test" \
    "localhost/proxy/api/workflow/bulk/restart" -v -X POST \
    -H "Content-Type: application/json" \
    -d '["381f879d-3225-4605-b1c4-91e1c00f8ab9"]'

curl  -H "x-tenant-id: fb-test" \
    "localhost/proxy/api/workflow/bulk/terminate" -v -X POST \
    -H "Content-Type: application/json" \
    -d '["7d40eb5f-6a0d-438d-a35c-3b2111e2744b"]'

curl  -H "x-tenant-id: fb-test" \
    "localhost/proxy/api/workflow/bulk/terminate" -v -X DELETE \
    -H "Content-Type: application/json" \
    -d '["7d40eb5f-6a0d-438d-a35c-3b2111e2744b"]'

*/
const bulkOperationBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  const requestWorkflowIds = req.body; // expect JS array
  if (!Array.isArray(requestWorkflowIds) || requestWorkflowIds.length === 0) {
    console.error('Expected non empty array', { requestWorkflowIds });
    res.status(400);
    res.send('Expected array of workflows');
    return;
  }
  // use search api to obtain workflow names
  // Manually encode quotes due to
  // https://github.com/request/request/issues/3181

  // FIXME: query with AND does not limit result as expected
  //const limitToTenant =
  // `workflowType STARTS_WITH &quot;${tenantId}_&quot; AND `;

  let query = 'workflowId+IN+(';

  for (const workflowId of requestWorkflowIds) {
    if (typeof workflowId === 'string' && /^[a-z0-9-]+$/i.test(workflowId)) {
      query += workflowId + ',';
    } else {
      console.error('Unexpected workflowId format', { workflowId });
      res.status(400);
      res.send('Unexpected workflowId format');
      return;
    }
  }
  query += ')';
  const queryUrl = proxyTarget + '/api/workflow/search?query=' + query;
  // first make a HTTP request to validate that all workflows belong to tenant
  const requestOptions = {
    url: queryUrl,
    method: 'GET',
  };
  console.info(`Requesting ${JSON.stringify(requestOptions)}`);
  request(requestOptions, function (error, response, body) {
    console.info(`Got status code: ${response.statusCode}, body: ${body}`);
    const searchResult = JSON.parse(body);
    // only keep found workflows
    // security - check WorkflowType prefix
    removeTenantPrefix(
      identity.tenantId,
      searchResult,
      'results[*].workflowType',
      false,
    );
    const foundWorkflowIds = findValuesByJsonPath(
      searchResult,
      'results[*].workflowId',
      'value',
    );

    // for security reasons, make intersection between workflows and
    // validWorkflowIds
    for (let idx = foundWorkflowIds.length - 1; idx >= 0; idx--) {
      const foundWorkflowId = foundWorkflowIds[idx];
      if (requestWorkflowIds.includes(foundWorkflowId) === false) {
        console.warn(
          `ElasticSearch returned workflow that was not requested:` +
            ` ${foundWorkflowId.workflowId}`,
          {
            requestWorkflowIds,
          },
        );
        foundWorkflowIds.splice(idx, 1);
      }
    }
    console.info(`Sending bulk operation: ${foundWorkflowIds}`);
    proxyCallback({ buffer: createProxyOptionsBuffer(foundWorkflowIds, req) });
  });
};

let proxyTarget: string;

const registration: TransformerRegistrationFun = (ctx) => {
  proxyTarget = ctx.proxyTarget;
  return [
    {
      method: 'post',
      url: '/api/workflow/bulk/terminate',
      before: bulkOperationBefore,
    },
    {
      method: 'delete',
      url: '/api/workflow/bulk/terminate',
      before: bulkOperationBefore,
    },
    {
      method: 'put',
      url: '/api/workflow/bulk/pause',
      before: bulkOperationBefore,
    },
    {
      method: 'put',
      url: '/api/workflow/bulk/resume',
      before: bulkOperationBefore,
    },
    {
      method: 'post',
      url: '/api/workflow/bulk/retry',
      before: bulkOperationBefore,
    },
    {
      method: 'post',
      url: '/api/workflow/bulk/restart',
      before: bulkOperationBefore,
    },
  ];
};

export default registration;
