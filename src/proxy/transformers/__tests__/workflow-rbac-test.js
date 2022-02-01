/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import workflows, {correlationIdCheck, postWorkflowBeforeRbac} from '../workflow';
import {findTransformerFx, mockRequest, mockResponse} from './metadata-workflowdef-test';
import streamToString from "stream-to-string/index";
import {mockIdentity} from "./metadata-workflowdef-rbac-test";

let blueprint = require('./workflow_defs/multpile_workflows_labeled.json');
const singleLabeledWorkflow = () => JSON.parse(JSON.stringify(blueprint))[0];

const transformers = workflows({"proxyTarget": "PROXY_TARGET"});
const postWorkflowBeforeHandler = postWorkflowBeforeRbac;
const mockExecReq = () => mockRequest(
  {"name": "wf1", "version": "1.1"},
  {},
  {"x-tenant-id": "FACEBOOK", "from": "a@fb.com"});

describe('Workflow transformers', () => {

  test("Post workflow execution before Auth ok", () => {

    return new Promise((resolve) => {
      let streamToStringCallback = function (input) {
        streamToString(input.buffer).then((workflow) => resolve(workflow));
      };
      let identity = mockIdentity("FACEBOOK", ["admin", "bbb"]);
      postWorkflowBeforeHandler(identity, mockExecReq(), null, streamToStringCallback,
        (workflowDefRequest, onWorkflowDefCheck) => {
          onWorkflowDefCheck(null, {"statusCode": 200}, JSON.stringify(singleLabeledWorkflow()));
        });

    }).then((wfExec) => {
      expect(JSON.parse(wfExec)).toStrictEqual({
        "name": "FACEBOOK___wf1",
        "version": "1.1",
        "taskToDomain": {"*": "FACEBOOK"},
        "correlationId": "a@fb.com"
      });
    });
  });

  test("Post workflow execution before Auth not matching", () => {
    let response = mockResponse();
    return new Promise((resolve) => {
      let identity = mockIdentity("FACEBOOK", ["groups not ok"]);
      postWorkflowBeforeHandler(identity, mockExecReq(), response, null,
        (workflowDefRequest, onWorkflowDefCheck) => {
          onWorkflowDefCheck(null, {"statusCode": 427}, "Unauthorized");
          resolve();
        });
    }).then(() => {
      expect(response.status).toStrictEqual(427);
      expect(response.msg).toStrictEqual("Unauthorized");
    });
  });

  test("Post workflow execution before Auth fail", () => {
    let response = mockResponse();
    return new Promise((resolve) => {
      let identity = mockIdentity("FACEBOOK", ["groups not ok"]);
      postWorkflowBeforeHandler(identity, mockExecReq(), response, null,
        (workflowDefRequest, onWorkflowDefCheck) => {
          onWorkflowDefCheck(null, {"statusCode": 500}, JSON.stringify(singleLabeledWorkflow()));
          resolve();
        });

    }).then(() => {
      expect(response.status).toStrictEqual(500);
    });
  });

  test("Search workflow execution before", () => {
    const transformer = findTransformerFx(transformers, "/api/workflow/search", "get", "before");

    let mockReq = mockRequest("", {"name": "wf31"}, {'from': "fb.com"},
      {"pathname": "/api/workflow/search", "query": "status+IN+(FAILED)"});

    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };

      transformer(mockIdentity(), mockReq, null, callback);
    }).then(() => {
      expect(mockReq.url)
        .toStrictEqual("/api/workflow/search?"
              + escape("status IN (FAILED)") + "=&query="
              + escape("((correlationId = 'fb.com') AND ")
              + escape("(workflowType STARTS_WITH 'FACEBOOK_'))"));
    });
  });

  test("Get workflow execution auth fail", () => {
    let res = mockResponse();
    let mockReq = mockRequest("", {}, {"from": "user"});
    correlationIdCheck({"correlationId": "notMatching"}, mockReq, res);
    expect(res.status).toStrictEqual(427);
  });
});
