/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

describe('Workflow transformers', () => {
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
