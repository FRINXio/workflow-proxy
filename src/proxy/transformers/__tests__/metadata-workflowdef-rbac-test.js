/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */
import metadataWorkflowdefRbac from '../metadata-workflowdef';
import { findTransformerFx, mockResponse } from './metadata-workflowdef-test';

const transformers = metadataWorkflowdefRbac();
const workflowMetaTransformer = findTransformerFx(
  transformers,
  '/api/metadata/workflow',
  'get',
  'after',
);
const singleWorkflowMetaTransformer = findTransformerFx(
  transformers,
  '/api/metadata/workflow/:name',
  'get',
  'after',
);

let blueprintPrefixed = require('./workflow_defs/multpile_workflows_labeled_prefixed.json');
const unfilteredWorkflowsPrefixed = () =>
  JSON.parse(JSON.stringify(blueprintPrefixed));
let blueprint = require('./workflow_defs/multpile_workflows_labeled.json');
const unfilteredWorkflows = () => JSON.parse(JSON.stringify(blueprint));

export function mockIdentity(tenantId = 'FACEBOOK', groups = [], roles = []) {
  return { tenantId: tenantId, roles: roles, groups: groups };
}

describe('Workflow def RBAC transformers', () => {
  test('should return error when asking for a single workflow not matching group', () => {
    let input = unfilteredWorkflowsPrefixed()[0];
    const res = mockResponse();
    singleWorkflowMetaTransformer(mockIdentity(), null, input, res);
    expect(res['status']).toEqual(427);
    expect(res['msg']).toEqual('User unauthorized to access this endpoint');
  });

  test('should return single workflow matching group', () => {
    let input = unfilteredWorkflowsPrefixed()[0];
    singleWorkflowMetaTransformer(
      mockIdentity('FACEBOOK', ['ADMIN']),
      null,
      input,
      null,
    );
    expect(input).toEqual({
      name: 'workflow1',
      description: "{\"description\": \"description\", \"labels\": [\"LABEL\"], \"rbac\": [\"ADMIN\",\"OWNER\"]}",
      tasks: [
        {
          name: 'task_1',
          taskReferenceName: 'task_1',
          type: 'SIMPLE',
        },
      ],
    });
  });

  test('should filter workflows by label', () => {
    let input = unfilteredWorkflowsPrefixed();
    workflowMetaTransformer(mockIdentity(), null, input, null);
    expect(input).toEqual([]);

    input = unfilteredWorkflowsPrefixed();
    workflowMetaTransformer(
      mockIdentity('FACEBOOK', ['ADMIN']),
      null,
      input,
      null,
    );
    expect(input).toEqual([
      {
        name: 'workflow1',
        description: "{\"description\": \"description\", \"labels\": [\"LABEL\"], \"rbac\": [\"ADMIN\",\"OWNER\"]}",
        tasks: [
          {
            name: 'task_1',
            taskReferenceName: 'task_1',
            type: 'SIMPLE',
          },
        ],
      },
      {
        name: 'workflow3',
        description: "{\"description\": \"description\", \"labels\": [\"LABEL\"], \"rbac\": [\"ADMIN\"]}",
        tasks: [
          {
            name: 'task_1',
            taskReferenceName: 'task_1',
            type: 'SIMPLE',
          },
        ],
      },
    ]);

    input = unfilteredWorkflowsPrefixed();
    workflowMetaTransformer(
      mockIdentity('FACEBOOK', ['ADMIN', 'OWNER']),
      null,
      input,
      null,
    );
    expect(input).toEqual(unfilteredWorkflows());
  });
});
