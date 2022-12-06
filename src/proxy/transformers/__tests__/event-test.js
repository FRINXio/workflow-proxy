/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import events from '../event';
import { findTransformerFx, mockRequest } from './metadata-workflowdef-test';
import streamToString from 'stream-to-string/index';

const adminIdentity = {
  tenantId: 'FACEBOOK',
  roles: [],
  groups: ['network-admin'],
};
const eventHandlerDefBody = require('./events/event_handler.json');
const eventHandlerDef = () => JSON.parse(JSON.stringify(eventHandlerDefBody));
const eventHandlerDefPrefixedBody = require('./events/event_handler_prefixed.json');
const eventHandlerDefPrefixed = () =>
  JSON.parse(JSON.stringify(eventHandlerDefPrefixedBody));

describe('Event transformers', () => {
  const transformers = events({ proxyTarget: 'PROXY_TARGET' });
  test('POST event execution before', () => {
    const eventPostTransformer = findTransformerFx(
      transformers,
      '/api/event',
      'post',
      'before',
    );

    return new Promise((resolve) => {
      let callback = function (input) {
        streamToString(input.buffer).then((event) => resolve(event));
      };
      let mocqReq = mockRequest(eventHandlerDef(), {}, { from: 'a@fb.com' });
      eventPostTransformer(adminIdentity, mocqReq, null, callback);
    }).then((eventExec) => {
      expect(JSON.parse(eventExec)).toStrictEqual(eventHandlerDefPrefixed());
    });
  });

  test('PUT event execution before', () => {
    const eventPutTransformer = findTransformerFx(
      transformers,
      '/api/event',
      'put',
      'before',
    );

    return new Promise((resolve) => {
      let callback = function (input) {
        streamToString(input.buffer).then((event) => resolve(event));
      };
      let mocqReq = mockRequest(eventHandlerDef(), {}, { from: 'a@fb.com' });
      eventPutTransformer(adminIdentity, mocqReq, null, callback);
    }).then((eventExec) => {
      expect(JSON.parse(eventExec)).toStrictEqual(eventHandlerDefPrefixed());
    });
  });
});
