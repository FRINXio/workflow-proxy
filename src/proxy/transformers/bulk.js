/**
 * Copyright 2004-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type { TransformerRegistrationFun } from '../../types';

const registration: TransformerRegistrationFun = (ctx) => {
  return [
    {
      method: 'post',
      url: '/api/workflow/bulk/terminate',
    },
    {
      method: 'delete',
      url: '/api/workflow/bulk/terminate',
    },
    {
      method: 'put',
      url: '/api/workflow/bulk/pause',
    },
    {
      method: 'put',
      url: '/api/workflow/bulk/resume',
    },
    {
      method: 'post',
      url: '/api/workflow/bulk/retry',
    },
    {
      method: 'post',
      url: '/api/workflow/bulk/restart',
    },
  ];
};

export default registration;
