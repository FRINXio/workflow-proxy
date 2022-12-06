/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import taskdefs from '../metadata-taskdef';
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
  const transformers = taskdefs({ proxyTarget: 'PROXY_TARGET' });

  test('Search workflow execution after', () => {
    let workflowExecutionPrefixedText = require('./tasks/taskdefs_prefixed.json');
    const workflowExecutionPrefixed = () =>
      JSON.parse(JSON.stringify(workflowExecutionPrefixedText));
    let workflowExecutionText = require('./tasks/taskdefs.json');
    const workflowExecution = () =>
      JSON.parse(JSON.stringify(workflowExecutionText));

    const transformer = findTransformerFx(
      transformers,
      '/api/metadata/taskdefs',
      'get',
      'after',
    );

    let exec = workflowExecutionPrefixed();
    transformer(adminIdentity, mockRequest(), exec);

    expect(exec).toStrictEqual(workflowExecution());
  });
});
