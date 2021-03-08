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
    [
      'Subworkflow should also be prefixed',
      require('./workflow_defs/single_subworkflow.json'),
      require('./workflow_defs/single_subworkflow_prefixed.json'),
    ],
    [
      'Dynamic_fork.expectedName should also be prefixed',
      require('./workflow_defs/workflow_with_dynamic_fork.json'),
      require('./workflow_defs/workflow_with_dynamic_fork_prefixed.json'),
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
      let mockReq = mockRequest(workflowDef(), {}, {"from": "testmail"});
      workflowPost({"tenantId": tenant, "roles": [], "groups": ["network-admin"]}, mockReq, null, callback);
    }).then((workflow) => {
      expect(JSON.parse(workflow)).toStrictEqual(workflowDefPrefixed());
    });
  });

  test("PUT workflow before", () => {
    const workflowPut = findTransformerFx(transformers, "/api/metadata/workflow", "put", "before");

    return new Promise(resolve => {
      let callback = function (input) {
        streamToString(input.buffer).then((workflow) => resolve(workflow));
      };
      let mockReq = mockRequest([workflowDef()], {}, {"from": "testmail"});
      workflowPut({"tenantId": tenant, "roles": [], "groups": ["network-admin"]}, mockReq, null, callback);
    }).then((workflow) => {
      expect(JSON.parse(workflow)).toStrictEqual([workflowDefPrefixed()]);
    });
  });

  test("READ workflow before", () => {
    const workflowGetBefore = findTransformerFx(transformers, "/api/metadata/workflow/:name", "get", "before");

    let mockReq = mockRequest("", {"name": "wf31"}, {}, {'query': "version=1.1"});
    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };
      workflowGetBefore({"tenantId": tenant, "roles": [], "groups": ["network-admin"]}, mockReq, null, callback);
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
      workflowGetBefore({"tenantId": tenant, "roles": [], "groups": ["network-admin"]}, mockReq, null, callback);
    }).then(() => {
      expect(mockReq.url).toStrictEqual("/api/metadata/workflow/FACEBOOK___wf31/1.1");
    });
  });

  test("Do not allow taskToDomain in subworkflows", async () => {
    const workflowPost = findTransformerFx(transformers, "/api/metadata/workflow", "post", "before");
    console.log('workflowPost', workflowPost);
    // const workflowPut = findTransformerFx(transformers, "/api/metadata/workflow", "put", "before");
    expect(() => {
      let callback = function (input) {
        throw new Error("Unreachable " + input);
      };
      let wd = JSON.parse(JSON.stringify(workflowDef()));
      let subWorkflowTask = wd.tasks[2];
      expect(subWorkflowTask.type).toStrictEqual('SUB_WORKFLOW');
      subWorkflowTask.subWorkflowParam.taskToDomain = { "*" : "NO_DOMAIN"};
      let mockReq = mockRequest(wd, {}, {"from": "testmail"});
      workflowPost({"tenantId": tenant, "roles": [], "groups": ["network-admin"]}, mockReq, null, callback);
    }).toThrowError(new Error('Attribute taskToDomain in subWorkflowParam is not allowed'));
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
