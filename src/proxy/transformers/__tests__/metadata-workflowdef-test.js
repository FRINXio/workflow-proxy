/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import metadataWorkflowdef, {sanitizeWorkflowdefAfter, sanitizeWorkflowdefBefore,} from '../metadata-workflowdef';
import streamToString from "stream-to-string/index";

const tenant = 'FACEBOOK';

function findTransformerFx(transformers, uri, post, beforeAfter) {
  return transformers.find(obj => obj.url === uri && obj.method === post)[beforeAfter];
}

describe('Workflow def transformers', () => {
  const testCases = [
    [
      'Decision with nested tasks',
      require('./workflow_defs/nested_tasks_decision.json'),
      require('./workflow_defs/nested_tasks_decision_prefixed.json'),
    ],
  ];

  test.each(testCases)('%s', (_, workflowDef, workflowDefPrefixed) => {
    const workflowDefTest = JSON.parse(JSON.stringify(workflowDef));

    // add prefixes etc
    const req = {headers: {from: 'testmail'}};
    sanitizeWorkflowdefBefore(tenant, workflowDefTest, req);
    expect(workflowDefTest).toStrictEqual(workflowDefPrefixed);

    // remove prefixes etc
    sanitizeWorkflowdefAfter(tenant, workflowDefTest);
    // Only difference with original is that it should have the ownerEmail attribute
    workflowDef.ownerEmail = "testmail";
    expect(workflowDefTest).toStrictEqual(workflowDef);
  });

  const transformers = metadataWorkflowdef();
  let workflowDefPrefixedText = require('./workflow_defs/nested_tasks_decision_prefixed.json');
  const workflowDefPrefixed = () => JSON.parse(JSON.stringify(workflowDefPrefixedText));
  let workflowDefText = require('./workflow_defs/nested_tasks_decision.json');
  const workflowDef = () => JSON.parse(JSON.stringify(workflowDefText));

  test("POST workflow before", () => {
    const workflowPost = findTransformerFx(transformers, "/api/metadata/workflow", "post", "before");

    return new Promise(resolve => {
      let callback = function (input) {
        streamToString(input.buffer).then((workflow) => resolve(workflow));
      };
      workflowPost(tenant, [], mockRequest(workflowDef()), null, callback);
    }).then((workflow) => {
      expect(workflow).toStrictEqual(JSON.stringify(workflowDefPrefixed()));
    });
  });

  test("PUT workflow before", () => {
    const workflowPost = findTransformerFx(transformers, "/api/metadata/workflow", "put", "before");

    return new Promise(resolve => {
      let callback = function (input) {
        streamToString(input.buffer).then((workflow) => resolve(workflow));
      };
      workflowPost(tenant, [], mockRequest([workflowDef()]), null, callback);
    }).then((workflow) => {
      expect(workflow).toStrictEqual(JSON.stringify([workflowDefPrefixed()]));
    });
  });

  test("READ workflow before", () => {
    const workflowGetBefore = findTransformerFx(transformers, "/api/metadata/workflow/:name", "get", "before");

    let mockReq = mockRequest("", {"name": "wf31"}, {}, {'query': "version=1.1"});
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };
      workflowGetBefore(tenant, [], mockReq, null, callback);
    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/metadata/workflow/FACEBOOK___wf31?version=1.1");
    });
  });

  test("Delete workflow before", () => {
    const workflowGetBefore = findTransformerFx(transformers, "/api/metadata/workflow/:name/:version", "delete", "before");

    let mockReq = mockRequest("", {"name": "wf31", "version": "1.1"});
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };
      workflowGetBefore(tenant, [], mockReq, null, callback);
    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/metadata/workflow/FACEBOOK___wf31/1.1");
    });
  });
});

function mockRequest(body, params: {}, headers: {}, _parsedUrl: {}) {
  return {'body': body, 'headers': {...headers, ...{"content-length": 0}}, 'params': params, '_parsedUrl': _parsedUrl};
}

function mockResponse() {
  const res = {"status": 0, "msg": ""};
  res.status = (stat) => {
    res["status"] = stat;
    return res;
  };
  res.send = (msg) => {
    res["msg"] = msg;
  };
  return res;
}

export {findTransformerFx, mockRequest, mockResponse};