/*
Proxy around conductor that adds task domain to executed workflow.
Task domains are used to separate tenants.
*/
import ExpressApplication from 'express';
import genericProxy from './generic-proxy.js';
import { extractTenantId, createProxyOptionsBuffer } from './proxy/utils.js';
const app = ExpressApplication();

const schellarProxy = {
  init: function (conductorProxyTarget, port) {
    const transformers = [
      {
        url: '/api/workflow',
        method: 'post',
        instead: async function (req, res, proxyCallback) {
          const workflow = req.body;
          console.debug('sp workflow input', workflow);
          const tenantId = extractTenantId(workflow.name);
          workflow.taskToDomain = {'*': tenantId};
          // Expect that input.correlationId is filled by schellar.js .
          // Move correlationId from input to a root attribute.
          workflow.correlationId = workflow.input.correlationId;
          delete workflow.input.correlationId;
          console.debug('sp workflow transformed', workflow);
          proxyCallback({buffer: createProxyOptionsBuffer(workflow, req)});
        },
      },
      {
        url: '*',
        method: 'all',
      },
    ];
    const proxyRouter = genericProxy('sp', conductorProxyTarget, transformers);
    app.use('/', proxyRouter);
    app.listen(port);
  },
};

export default schellarProxy;
