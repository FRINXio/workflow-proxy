/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import workflows from '../workflow-rbac';
import {findTransformerFx, mockRequest, mockResponse} from './metadata-workflowdef-test';
import streamToString from "stream-to-string/index";

let tenant = "FACEBOOK";

describe('Workflow transformers', () => {

  const transformers = workflows({"proxyTarget": "PROXY_TARGET"});

  test("Search workflow execution before", () => {
    const transformer = findTransformerFx(transformers, "/api/workflow/search", "get", "before");

    let mockReq = mockRequest("", {"name": "wf31"}, {'from': "fb.com"},
        {"pathname": "/api/workflow/search", "query": "status+IN+(FAILED)"});

    return new Promise(resolve => {
      let callback = function () {
        resolve();
      };
      transformer(tenant, [], mockReq, null, callback);
    }).then(() => {
      expect(mockReq.url)
          .toStrictEqual("/api/workflow/search?"
              + escape("status IN (FAILED)") + "=&query="
              + escape("((correlationId = 'fb.com') AND ")
              + escape("(workflowType STARTS_WITH 'FACEBOOK_'))"));
    });
  });
});
