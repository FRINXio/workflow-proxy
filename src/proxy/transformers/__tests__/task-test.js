/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import { mockRequest } from './metadata-workflowdef-test';
import { createProxyOptionsBuffer } from '../../utils';

describe('Task transformers', () => {
  test('Response body size with UTF8', () => {
    let req = mockRequest({}, {}, {});
    let streamCopy = createProxyOptionsBuffer('ä UTF8 test', req);

    return new Promise(function (resolve, reject) {
      const Stream = require('stream');
      const writable = new Stream.Writable({ objectMode: true });
      writable._write = (object, encoding, done) => {
        resolve(object);
      };
      streamCopy.pipe(writable);
    }).then(function (content) {
      expect(req.headers['content-length']).toStrictEqual(12);
      expect(content).toStrictEqual('ä UTF8 test');
    });
  });
});
