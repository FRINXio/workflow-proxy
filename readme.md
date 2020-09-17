# Workflow Proxy

## User facing proxy
Default port: 8088

Environment variable: `USER_FACING_PORT`

This is the main proxy that is used whenever the user's browser interacts with
Conductor APIs. It expects following authentication headers:
* x-tenant-id
* from

Main responsibilities:
* Add tenancy support
* Implement additional APIs required by
[frinx-workflow-ui](https://github.com/FRINXio/frinx-workflow-ui)
* Add RBAC support (privileged vs limited user based on roles and groups)
* Add scheduling APIs forwarded to [schellar](https://github.com/flaviostutz/schellar)
* Limit allowed system tasks, e.g. disallow the Lambda task.
* Send current user's email in `correlationId` when executing a workflow so that a
worker can use it for authentication purposes.
* Separate task queues for each tenant using [Task Domains](https://netflix.github.io/conductor/configuration/taskdomains/)


## Schellar proxy
Default port: 8087

Environment variable: `SCHELLAR_PROXY_PORT`

This proxy is used by Schellar when interacting with Conductor.
When Schellar executes a workflow, some metadata must be added.

Main responsibility:
* Add task domain (tenant Id) and email to the workflow execution request

In order to have separate task queues for each tenant, *Task Domain*
must be specified when executing each workflow.

Workers may reqiure to use current user's email for auth purposes. When creating
or updating a schedule, the email will be saved to Schellar's database.

Note about deprecation: once upstream adds ability to specify
`taskDomain` and `correlationId` fields, this proxy can be removed.

## Task proxy
Default port: 8089

Environment variable: `TASK_PROXY_PORT`

This proxy should be used by each worker instead of connecting directly to Conductor.

Main responsibility:
* Prevent single tenant from exhausting a worker by placing too many tasks on the queue

Workers should use the polling API to specify how many tasks they want to work on.
Task proxy augments this API: It loops over tenants and requests the tasks from each
tenant's queue, then sends combined result back to the worker.
Contrary to the User facing proxy, the response body is not cleaned from tenant prefixes,
so workers are able to figure out tenant Id based on the prefix of the workflow name.
