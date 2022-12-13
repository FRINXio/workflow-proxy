/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import metadataWorkflowdef from '../metadata-workflowdef';
import streamToString from 'stream-to-string/index';

const tenant = 'FACEBOOK';

function findTransformerFx(transformers, uri, method, beforeAfter) {
  return transformers.find((obj) => obj.url === uri && obj.method === method)[
    beforeAfter
  ];
}

describe('Workflow def transformers', () => {
  const transformers = metadataWorkflowdef();
  let workflowDefPrefixedText = require('./workflow_defs/nested_tasks_decision_prefixed.json');
  const workflowDefPrefixed = () =>
    JSON.parse(JSON.stringify(workflowDefPrefixedText));
  let workflowDefText = require('./workflow_defs/nested_tasks_decision.json');
  const workflowDef = () => JSON.parse(JSON.stringify(workflowDefText));

  test('POST workflow before', () => {
    const workflowPost = findTransformerFx(
      transformers,
      '/api/metadata/workflow',
      'post',
      'before',
    );

    return new Promise((resolve) => {
      let callback = function (input) {
        streamToString(input.buffer).then((workflow) => resolve(workflow));
      };
      let mockReq = mockRequest(workflowDef(), {}, { from: 'testmail' });
      workflowPost(
        { tenantId: tenant, roles: [], groups: ['network-admin'] },
        mockReq,
        null,
        callback,
      );
    }).then((workflow) => {
      expect(JSON.parse(workflow)).toStrictEqual(workflowDefPrefixed());
    });
  });

  test('PUT workflow before', () => {
    const workflowPut = findTransformerFx(
      transformers,
      '/api/metadata/workflow',
      'put',
      'before',
    );

    return new Promise((resolve) => {
      let callback = function (input) {
        streamToString(input.buffer).then((workflow) => resolve(workflow));
      };
      let mockReq = mockRequest([workflowDef()], {}, { from: 'testmail' });
      workflowPut(
        { tenantId: tenant, roles: [], groups: ['network-admin'] },
        mockReq,
        null,
        callback,
      );
    }).then((workflow) => {
      expect(JSON.parse(workflow)).toStrictEqual([workflowDefPrefixed()]);
    });
  });
});

function mockRequest(body, params: {}, headers: {}, _parsedUrl: {}) {
  return {
    body: body,
    headers: { ...headers, ...{ 'content-length': 0 } },
    params: params,
    _parsedUrl: _parsedUrl,
  };
}

function mockResponse() {
  const res = { status: 0, msg: '' };
  res.status = (stat) => {
    res['status'] = stat;
    return res;
  };
  res.send = (msg) => {
    res['msg'] = msg;
  };
  return res;
}

export { findTransformerFx, mockRequest, mockResponse };
