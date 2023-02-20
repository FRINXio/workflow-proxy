/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {TransformerRegistrationFun} from '../../types';
import {createProxyOptionsBuffer} from "../utils";

function genericBefore() {
  return function (identity, req, res, proxyCallback) {
    proxyCallback({buffer: createProxyOptionsBuffer(req.body, req)});
  };
}

const registration: TransformerRegistrationFun = (ctx) => {
  return [
    {
      method: 'post',
      url: '/api/workflow/bulk/terminate',
      before: genericBefore
    },
    {
      method: 'put',
      url: '/api/workflow/bulk/pause',
      before: genericBefore
    },
    {
      method: 'put',
      url: '/api/workflow/bulk/resume',
      before: genericBefore
    },
    {
      method: 'post',
      url: '/api/workflow/bulk/retry',
      before: genericBefore
    },
    {
      method: 'post',
      url: '/api/workflow/bulk/restart',
      before: genericBefore
    },
  ];
};

export default registration;
