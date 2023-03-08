/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type { BeforeFun, TransformerRegistrationFun } from '../../types';
import { createProxyOptionsBuffer } from '../utils.js';

const genericBefore: BeforeFun = (identity, req, res, proxyCallback) => {
  let reqObj = req.body;
  proxyCallback({ buffer: createProxyOptionsBuffer(reqObj, req) });
};

const registration: TransformerRegistrationFun = () => [
  {
    method: 'post',
    url: '/api/workflow/bulk/terminate',
    before: genericBefore,
  },
  {
    method: 'put',
    url: '/api/workflow/bulk/pause',
    before: genericBefore,
  },
  {
    method: 'put',
    url: '/api/workflow/bulk/resume',
    before: genericBefore,
  },
  {
    method: 'post',
    url: '/api/workflow/bulk/retry',
    before: genericBefore,
  },
  {
    method: 'post',
    url: '/api/workflow/bulk/restart',
    before: genericBefore,
  },
];

export default registration;
