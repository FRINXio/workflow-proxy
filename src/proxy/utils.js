/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import streamify from 'stream-array';
import { JSONPath } from 'jsonpath-plus';

import type { ExpressRequest } from 'express';
import type { AuthorizationCheck, ProxyRequest, Workflow } from '../types';

export function isLabeledWithGroup(
  workflowdef: Workflow,
  groups: string[],
): boolean {
  const lowercaseGroups = groups.map((g) => g.toLowerCase().replace(/\s/g, ''));
  return getWorkflowLabels(workflowdef).some(
    (l) => lowercaseGroups.indexOf(l.toLowerCase()) >= 0,
  );
}

export function isLabeledWithRole(
  workflowdef: Workflow,
  roles: string[],
): boolean {
  const lowercaseRoles = roles.map((g) => g.toLowerCase().replace(/\s/g, ''));
  return getWorkflowLabels(workflowdef).some(
    (l) => lowercaseRoles.indexOf(l.toLowerCase()) >= 0,
  );
}

export function getWorkflowLabels(workflowdef: Workflow): string[] {
  const descr = workflowdef.description;
  try {
    // Extract labels from description as JSON
    let parsedDescription = JSON.parse(descr);
    if (parsedDescription?.labels) {
      return parsedDescription.labels;
    }
  } catch (e) {
    // Fallback solution, deprecated format of storing labels
    if (descr && descr.match(/-(,|) [A-Z].*/g)) {
      return descr
        .substring(descr.indexOf('-') + 1)
        .replace(/\s/g, '')
        .split(',');
    }
  }

  // No labels found either as json or text
  return [];
}

// TODO: necessary because of https://github.com/facebook/flow/issues/2221
export function objectToValues<A, B>(obj: { [key: A]: B }): Array<B> {
  // eslint-disable-next-line flowtype/no-weak-types
  return ((Object.values(obj): Array<any>): Array<B>);
}

export function getUserEmail(req: ExpressRequest): string {
  const userEmail: ?string = req.headers['from'];
  if (userEmail == null) {
    console.error('"from" header not found');
    throw '"from" header not found';
  }
  return userEmail;
}

export function getUserRoles(req: ExpressRequest): Promise<string[]> {
  const userRole: ?string = req.headers['x-auth-user-roles'];
  if (userRole == null) {
    return [];
  }
  return userRole.split(',');
}

export function getUserGroups(req: ExpressRequest): Promise<string[]> {
  const userGroup: ?string = req.headers['x-auth-user-groups'];
  if (userGroup == null) {
    return [];
  }

  return userGroup.split(',');
}

export function createProxyOptionsBuffer(
  modifiedBody: mixed,
  req: ProxyRequest,
): mixed {
  // if request transformer returned modified body,
  // serialize it to new request stream. Original
  // request stream was already consumed. See `buffer` option
  // in node-http-proxy.
  if (typeof modifiedBody === 'object') {
    modifiedBody = JSON.stringify(modifiedBody);
  }
  if (typeof modifiedBody === 'string') {
    req.headers['content-length'] = Buffer.byteLength(modifiedBody, 'utf8');
    // create an array
    modifiedBody = [modifiedBody];
  } else {
    console.error('Unknown type', { modifiedBody });
    throw 'Unknown type';
  }
  return streamify(modifiedBody);
}

export function findValuesByJsonPath(
  json: mixed,
  path: string,
  resultType: string = 'all',
) {
  const result = JSONPath({ json, path, resultType });
  console.info(`For path '${path}' found ${result.length} items`);
  return result;
}

// TODO: delete this once the proxy is 100% typed
// eslint-disable-next-line flowtype/no-weak-types
export function anythingTo<T>(anything: any): T {
  if (anything != null) {
    return (anything: T);
  } else {
    throw new Error('Unexpected: value does not exist');
  }
}

const OWNER_ROLE = (process.env.ADMIN_ACCESS_ROLE || 'OWNER')
  .trim()
  .split(',')
  .filter((elm) => elm);

const NETWORK_ADMIN_GROUP = (process.env.ADMIN_ACCESS_ROLE || 'network-admin')
  .trim()
  .split(',')
  .filter((elm) => elm);

const NETWORK_OWNER = OWNER_ROLE.concat(NETWORK_ADMIN_GROUP);

export const adminAccess: AuthorizationCheck = (identity) => {
  return (
    identity.roles.filter((value) => NETWORK_OWNER.includes(value)).length >
      0 ||
    identity.groups.filter((value) => NETWORK_OWNER.includes(value)).length > 0
  );
};
