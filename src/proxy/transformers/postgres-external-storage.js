/**
 * Copyright 2021-present Facebook. All Rights Reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {TransformerRegistrationFun} from '../../types';

let proxyTarget: string;

const registration: TransformerRegistrationFun = function(ctx) {
    proxyTarget = ctx.proxyTarget;
    return [
        {
            method: 'get',
            url: '/api/external/postgres/:dataId',
        },
    ];
};

export default registration;
