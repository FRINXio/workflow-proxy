/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import workflows from '../workflow';
import {
  findTransformerFx,
  mockRequest,
  mockResponse,
} from './metadata-workflowdef-test';
import streamToString from 'stream-to-string/index';
import { mockIdentity } from './metadata-workflowdef-rbac-test';

const adminIdentity = {
  tenantId: 'FACEBOOK',
  roles: [],
  groups: ['network-admin'],
};
describe('Workflow transformers', () => {
  const transformers = workflows({ proxyTarget: 'PROXY_TARGET' });

  test('POST workflow execution before', () => {
    const transformer = findTransformerFx(
      transformers,
      '/api/workflow',
      'post',
      'before',
    );

    return new Promise((resolve) => {
      let callback = function (input) {
        streamToString(input.buffer).then((workflow) => resolve(workflow));
      };
      transformer(
        adminIdentity,
        mockRequest({ name: 'wf1', version: '1.1' }, {}, { from: 'a@fb.com' }),
        null,
        callback,
      );
    }).then((wfExec) => {
      expect(wfExec).toStrictEqual(
        JSON.stringify({
          name: 'FACEBOOK___wf1',
          version: '1.1',
          taskToDomain: { '*': 'FACEBOOK' },
          correlationId: 'a@fb.com',
        }),
      );
    });
  });

  test('Search workflow execution before', () => {
    const transformer = findTransformerFx(
      transformers,
      '/api/workflow/search',
      'get',
      'before',
    );

    let mockReq = mockRequest(
      '',
      { name: 'wf31' },
      {},
      { pathname: '/api/workflow/search', query: 'status+IN+(FAILED)' },
    );

    return new Promise((resolve) => {
      let callback = function () {
        resolve();
      };
      transformer(adminIdentity, mockReq, null, callback);
    }).then(() => {
      expect(mockReq.url).toStrictEqual(
        '/api/workflow/search?' +
          escape('status IN (FAILED)') +
          '=&query=' +
          escape("(workflowType STARTS_WITH 'FACEBOOK_')"),
      );
    });
  });

  test('Search running workflow before', () => {
    const transformer = findTransformerFx(
      transformers,
      '/api/workflow/running/:workflowType',
      'get',
      'before',
    );

    let mockReq = mockRequest(
      '',
      { workflowType: 'mockWorkflow' },
      {},
      { pathname: '/api/workflow/running', query: 'started=1999-10-10' },
    );

    return new Promise((resolve) => {
      let callback = function () {
        resolve();
      };
      transformer(adminIdentity, mockReq, null, callback);
    }).then(() => {
      expect(mockReq.url).toStrictEqual(
        '/api/workflow/running/FACEBOOK___mockWorkflow?started=1999-10-10',
      );
    });
  });

  test('Search workflow execution after', () => {
    let workflowExecutionPrefixedText = require('./execs/workflow_execution_prefixed.json');
    const workflowExecutionPrefixed = () =>
      JSON.parse(JSON.stringify(workflowExecutionPrefixedText));
    let workflowExecutionText = require('./execs/workflow_execution.json');
    const workflowExecution = () =>
      JSON.parse(JSON.stringify(workflowExecutionText));

    const transformer = findTransformerFx(
      transformers,
      '/api/workflow/:workflowId',
      'get',
      'after',
    );

    let exec = workflowExecutionPrefixed();
    transformer(adminIdentity, mockRequest(), exec);

    expect(exec).toStrictEqual(workflowExecution());
  });

  test('GET workflow execution after', () => {
    let workflowExecutionPrefixedText = require('./execs/workflow_execution_prefixed.json');
    const workflowExecutionPrefixed = () =>
      JSON.parse(JSON.stringify(workflowExecutionPrefixedText));
    let workflowExecutionText = require('./execs/workflow_execution.json');
    const workflowExecution = () =>
      JSON.parse(JSON.stringify(workflowExecutionText));

    const transformer = findTransformerFx(
      transformers,
      '/api/workflow/:workflowId',
      'get',
      'after',
    );

    let exec = workflowExecutionPrefixed();
    transformer(adminIdentity, mockRequest(), exec);

    expect(exec).toStrictEqual(workflowExecution());
  });

  test('GET workflow execution after with dynamic fork', () => {
    let workflowExecutionPrefixedText = require('./execs/dynamic_exec_prefixed.json');
    const workflowExecutionPrefixed = () =>
      JSON.parse(JSON.stringify(workflowExecutionPrefixedText));
    let workflowExecutionText = require('./execs/dynamic_exec.json');
    const workflowExecution = () =>
      JSON.parse(JSON.stringify(workflowExecutionText));

    const transformer = findTransformerFx(
      transformers,
      '/api/workflow/:workflowId',
      'get',
      'after',
    );

    let exec = workflowExecutionPrefixed();
    transformer(adminIdentity, mockRequest(), exec);

    // TODO remove prefixes from dynamic task inputs/outputs - not harmful
    // expect(exec).toStrictEqual(workflowExecution());
  });

  test('GET workflow execution after 2', () => {
    let workflowExecutionPrefixedText = require('./execs/workflow_execution2_prefixed.json');
    const workflowExecutionPrefixed = () =>
      JSON.parse(JSON.stringify(workflowExecutionPrefixedText));
    let workflowExecutionText = require('./execs/workflow_execution2.json');
    const workflowExecution = () =>
      JSON.parse(JSON.stringify(workflowExecutionText));

    const transformer = findTransformerFx(
      transformers,
      '/api/workflow/:workflowId',
      'get',
      'after',
    );

    let exec = workflowExecutionPrefixed();
    transformer(adminIdentity, mockRequest(), exec);

    expect(exec).toStrictEqual(workflowExecution());
  });

  test('FreeText query workflowId parameters ', () => {
    const { freeText_query } = require('../../../routes');
    var req = {};
    req['query'] = {
      workflowId: '266663ed-d349-4f87-a490-ee8e653a2308',
      order: 'startTime:DESC,workflowId',
      status: 'COMPLETED',
    };
    var test = freeText_query(req, '');

    expect(test).toStrictEqual(
      '&sort=startTime:DESC&sort=workflowId&freeText=(workflowId:266663ed-d349-4f87-a490-ee8e653a2308)AND(status:COMPLETED)',
    );
  });

  test('FreeText query workflowType parameters', () => {
    const { freeText_query } = require('../../../routes');
    var req = {};
    req['query'] = {
      workflowId: 'Post_to_slack',
      order: 'startTime:ASC',
      status: 'FAILED',
    };
    var test = freeText_query(req, 'NOT(parentWorkflowId:*)');

    expect(test).toStrictEqual(
      '&sort=startTime:ASC&freeText=NOT(parentWorkflowId:*)AND(workflowType:**Post_to_slack*)AND(status:FAILED)',
    );
  });

  test('Hierarchical query wrong parameters 1', () => {
    const { freeText_query } = require('../../../routes');
    var req = {};
    req['query'] = {
      workflowId: 'Post_to_slack',
      order: 'startTime:ASC,',
      status: 'FAILET',
    };
    var test = [
      false,
      'Query input FAILET for filtering by status is not valid',
    ];

    expect(() => {
      freeText_query(req, '');
    }).toThrow();
  });

  test('Hierarchical query wrong parameters 2', () => {
    const { freeText_query } = require('../../../routes');
    var req = {};
    req['query'] = {
      workflowId: 'Post_to_slack',
      order: 'AST',
      status: 'FAILED',
    };
    var test = [false, 'Query input order=AST for sorting is not valid'];

    expect(() => {
      freeText_query(req, '');
    }).toThrow();
  });
});
