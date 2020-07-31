/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */
import metadataWorkflowdefRbac from '../metadata-workflowdef-rbac';

const transformers = metadataWorkflowdefRbac();
const workflowMetaTransformer = transformers.find(obj => obj.url === "/api/metadata/workflow").after;
const singleWorkflowMetaTransformer = transformers.find(obj => obj.url === "/api/metadata/workflow/:name").after;

let blueprintPrefixed = require('./workflow_defs/multpile_workflows_labeled_prefixed.json');
const unfilteredWorkflowsPrefixed = () => JSON.parse(JSON.stringify(blueprintPrefixed));
let blueprint = require('./workflow_defs/multpile_workflows_labeled.json');
const unfilteredWorkflows = () => JSON.parse(JSON.stringify(blueprint));

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

describe('Workflow def RBAC proxy', () => {

  test("should return error when asking for a single workflow not matching group", () => {
    let input = unfilteredWorkflowsPrefixed()[0];
    const res = mockResponse();
    singleWorkflowMetaTransformer("FACEBOOK", [], null, input, res);
    expect(res["status"]).toEqual(401);
    expect(res["msg"]).toEqual("User unauthorized to access this endpoint");
  });

  test("should return single workflow matching group", () => {
    let input = unfilteredWorkflowsPrefixed()[0];
    singleWorkflowMetaTransformer("FACEBOOK", ["ADMIN"], null, input, null);
    expect(input).toEqual(
      {
        "name": "workflow1",
        "description": "description - ADMIN,OWNER,TEST",
        "tasks": [
          {
            "name": "task_1",
            "taskReferenceName": "task_1",
            "type": "SIMPLE"
          }
        ]
      }
    );
  });

  test("should filter workflows by label", () => {
    let input = unfilteredWorkflowsPrefixed();
    workflowMetaTransformer("FACEBOOK", [], null, input, null);
    expect(input).toEqual([]);

    input = unfilteredWorkflowsPrefixed();
    workflowMetaTransformer("FACEBOOK", ["ADMIN"], null, input, null);
    expect(input).toEqual([
      {
        "name": "workflow1",
        "description": "description - ADMIN,OWNER,TEST",
        "tasks": [
          {
            "name": "task_1",
            "taskReferenceName": "task_1",
            "type": "SIMPLE"
          }
        ]
      }, {
        "name": "workflow3",
        "description": "description - ADMIN",
        "tasks": [
          {
            "name": "task_1",
            "taskReferenceName": "task_1",
            "type": "SIMPLE"
          },
        ]
      }
    ]);

    input = unfilteredWorkflowsPrefixed();
    workflowMetaTransformer("FACEBOOK", ["ADMIN", "OWNER"], null, input, null);
    expect(input).toEqual(unfilteredWorkflows());
  });
});