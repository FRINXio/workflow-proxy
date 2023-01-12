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
    const { format_query } = require('../../../routes');
    var req = {};
    req['query'] = {
      workflowId: '266663ed-d349-4f87-a490-ee8e653a2308',
      order: 'startTime:DESC,workflowId',
      status: 'COMPLETED',
    };
    var test = format_query(req, '');

    expect(test).toStrictEqual(
      "workflowId='266663ed-d349-4f87-a490-ee8e653a2308' AND status='COMPLETED'",
    );
  });

  test('FreeText query workflowType parameters', () => {
    const { format_query } = require('../../../routes');
    var req = {};
    req['query'] = {
      workflowId: 'Post_to_slack',
      order: 'startTime:ASC',
      status: 'FAILED',
    };
    var test = format_query(req, 'NOT(parentWorkflowId:*)');

    expect(test).toStrictEqual(
      "workflowType='Post_to_slack' AND status='FAILED'",
    );
  });

  test('Hierarchical query wrong parameters 1', () => {
    const { format_query } = require('../../../routes');
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
      format_query(req);
    }).toThrow();
  });

  // TODO fix sort in conductor
  // test('Hierarchical query wrong parameters 2', () => {
  //   const { format_query } = require('../../../routes');
  //   var req = {};
  //   req['query'] = {
  //     workflowId: 'Post_to_slack',
  //     order: 'AST',
  //     status: 'FAILED',
  //   };
  //   var test = [false, 'Query input order=AST for sorting is not valid'];

  //   expect(() => {
  //     format_query(req);
  //   }).toThrow();
  // });
});
