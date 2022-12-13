/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import { createProxyOptionsBuffer, getUserEmail } from '../utils.js';

import type { BeforeFun, TransformerRegistrationFun } from '../../types';

/*
curl \
 "localhost/proxy/api/event" -X PUT -H 'Content-Type: application/json' -d '
{
    "actions": [
        {
            "action": "complete_task",
            "complete_task": {
                "output": {},
                "taskRefName": "${targetTaskRefName}",
                "workflowId": "${targetWorkflowId}"
            }
        }
    ],
    "active": true,
    "event": "conductor:event:eventTaskRefZUEX",
    "name": "event_eventTaskRefZUEX"
}
' -v
*/

const postEventBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  let reqObj = req.body;
  reqObj.correlationId = getUserEmail(req);
  proxyCallback({ buffer: createProxyOptionsBuffer(reqObj, req) });
};

const putEventBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  let reqObj = req.body;
  reqObj.correlationId = getUserEmail(req);
  proxyCallback({ buffer: createProxyOptionsBuffer(reqObj, req) });
};

const registration: TransformerRegistrationFun = () => [
  {
    method: 'post',
    url: '/api/event',
    before: postEventBefore,
  },
  {
    method: 'put',
    url: '/api/event',
    before: putEventBefore,
  },
  {
    method: 'get',
    url: '/api/event',
  },
];

export default registration;
