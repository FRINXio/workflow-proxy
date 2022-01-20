# Workflow Proxy

Workflow proxy is an API proxy component for [conductor workflow engine](https://github.com/Netflix/conductor) that adds following features:
* Multitenancy
* RBAC support
* Workflow scheduling
* Additional features required by [frinx-workflow-ui](https://github.com/FRINXio/frinx-workflow-ui)

## Workflow proxy architecture

```
+--------------------------------------------------------------------------------------------+
|                                                                                            |
|   Workflow proxy                                                                           |
|                                                                                            |
|                /                                                                           |
|                 +----------------------+                                                   |
|                 | Conductor proxy      |                                                   |
|                 |  routes.js           |                                                   |
|                 |                      |                                                   |
|                 +----------+-----------+                                                   |
|                            | HTTP                                                          |
|                /proxy      |                                  /                            |
|                 +----------v-----------+                       +----------------------+    |
|                 | Tenant proxy         |                       | Task proxy           |    |
|                 |  proxy.js            <                       |  task+proxy.js       |    |
|                 |  transformers/*.js   |                       |                      |    |
|                 +----+------+----------+                       +-----------+----------+    |
|                      |      |                                              |               |
|                      |      |                                              |               |
+--------------------------------------------------------------------------------------------+
                       |      |                                              |
          +------------+      | HTTP                                         |
          |                   |                                              |
          |                   |             /api                             |
+---------v--------+      +---v---------------------------------+            |
| Schellar         |      | Conductor built in REST API         |            |
|                  |      |                                     <------------+
|                  |      |                                     |
+------------------+      +-------------------------------------+

```

The main components are:
* Conductor proxy
  * Additional features (REST api endpoints) required by [frinx-workflow-ui](https://github.com/FRINXio/frinx-workflow-ui)
* Tenant proxy
  * Multitenancy support
  * RBAC support
* Task proxy
  * Tenant aware task distribution to workers 

## User facing proxy

The tenant & RBAC proxy + conductor proxy form a single logical component: **User facing proxy** and are proxying following conductor REST endpoints:
* Workflow metadata (workflow definitions)
* Task metadata (task definitions)
* Task execution (polling / ACK / updates)
* Workflow executions
* Bulk operations for workflow executions
* Workflow schedules 
* Events

This is the main proxy that is used whenever the user's browser interacts with
Conductor APIs. It expects following authentication headers:
* x-tenant-id
* from
* x-auth-user-roles
* x-auth-user-groups

The execution path from when a request hits User facing proxy is as follows:
1. Conductor proxy
2. Tenant & RBAC proxy
3. Conductor

### Conductor proxy

Conductor proxy just adds a couple small features not present in conductor's API.
One example is hierarchical workflow execution lookup that allows a user to retrieve a workflow execution including all of its subworkflows.
For all the other endpoints, it is just a pass through.

Features implemented by this component are required by the workflow-ui.

### Tenant proxy

Conductor server does not support mutlitenancy on its own and all the data reside in a single database 
and conductor's REST API allows full access. 
**The main job of tenant proxy is to isolate tenants** (their requests and data) from one another.
It is achieved by adding tenant information to requests/data flowing towards conductor and removing them from requests/data coming from conductor.
Tenant proxy expects client's tenant ID to be set in every request's HTTP header.

List of transformations performed in tenant proxy per endpoint:
* Workflow metadata (workflow definitions)
  * Add/remove tenant id to workflow name in workflow definition as `TENANT___workflowName`
  * Filter workflow definitions based on tenant ID prefix when reading workflow definitions
  * Add/remove tenant id to task names (which are part of the workflow definition and are not globally allowed tasks)
  * Add user id into workflow's `ownerEmail` field
  * Add/remove tenant id to workflowDef.tasks[name=DYNAMIC_FORK&type=SUBWORKFLOW].inputParameters.expectedName
    * This is a special (conventional) inputParameter required by the UI and DYNAMIC_FORK to enforce all the dynamic tasks going into DYNAMIC_FORK are of the same name and type
    * Ensuring tasks executed by DYNAMIC_FORK are tenant isolated or GLOBAL or allowed SYSTEM tasks
    * This parameter has to always be named "expectedName" !!!
* Task metadata (task definitions)
  * Add/remove tenant id to task defition name as prefix in form of `TENANT___taskType`
  * Filter task definitions based on tenant ID prefix
* Task executions
  * Add/remove tenant id to task name
  * Add/remove tenant id to task.output.dynamic_tasks[*].name
    * This is a special (conventional) inputParameter required by DYNAMIC_FORK carrying tasks to be dynamically executed
    * This parameter has to always be named "dynamic_tasks" !!!
* Workflow executions
  * Add tenant id to workflow name in the workflow execution request
  * Add `taskToDomain` mapping to workflow execution request
    * TaskToDomain is set to `*:TENANT` to make sure all tasks will be marked with domain == tenant
    * This enables tasks to be polled based on their assigned domain (tenant id)
  * Add user id into `correlationId` field of workflow execution
    * To preserve the information about workflow executor
  * Remove tenant id prefix from workflow execution data when retrieving workflow execution
  * Filter workflow executions based on tenant ID prefix when retrieving workflow executions
* Bulk operations for workflow executions
  * Filter workflow executions based on tenant ID prefix when manipulating workflow executions in bulk
* Workflow schedules
  * Add/remove tenant id to workflow name in schedule definition
* Events
  * Add/remove tenant id to event name

**Tenant proxy also ensures that only allowed system tasks are permitted** in new workflow definitions.

The main reason for disabling some system task such as HTTP is that non-trivial tasks should always be executed outside of the conductor server (in dedicated workers).
Conductor server should remain just a coordination component and not also an executor. 
Having both responsibilities could cause server to overload with task execution and prevent it from coordinating workflow execution and other workers.

Having dedicated workers for non-trivial task also enables more suitable deployment considering scalability, security and other aspects. 

#### Scheduling

Workflow scheduling is handled by an external component [schellar](https://github.com/FRINXio/schellar).
Proxy also provides tenant aware REST API proxies for schellar.

#### RBAC

RBAC proxy adds 2 features on top of tenant proxy:
* Ensures user authorization to access certain endpoints
* Filters workflow definitions and workflow executions based on user's roles, groups and userID

RBAC support simply distinguishes 2 user types: an admin and everyone else.
An admin has full access to workflow API while ordinary user can only:
* Read workflow definitions
  * Ordinary user can only view workflow definitions belonging to the same groups
  * A workflow definition (created by an admin) can have multiple labels assigned
  * A user can belong into multiple groups 
    * User groups are identified in HTTP request's header field `x-auth-user-roles`
  * If an ordinary user's group matches one of workflow labels, the workflow becomes visible to the user
* Execute visible workflow definitions 
* Monitor running executions
  * Only those executed by the user currently logged in

Admin user is identified by having the role `OWNER` or belonging to group `netowork-admin`.
These are sent to the proxy via HTTP header entries.
These are configurable.

## Task proxy

This proxy should be used by each GLOBAL worker instead of connecting directly to Conductor.
There is a task proxy in the user facing proxy too. Both allow polling / ACK / update of executed tasks.
The difference is that user facing proxy only allows tenant isolated execution of tasks where Task proxy allows for GLOBAL workers.

Main responsibility:
* Prevent single tenant from exhausting a worker by placing too many tasks on the queue

Workers should use the polling API to specify how many tasks they want to work on.
Task proxy augments this API: It loops over tenants and requests the tasks from each
tenant's queue, then sends combined result back to the worker.
Contrary to the User facing proxy, the response body is not cleaned from tenant prefixes,
so workers are able to figure out tenant Id based on the prefix of the workflow name.

To determine all the tenant ids in the system, this proxy queries keycloak over HTTP.

## User guide

Workflow proxy is a standalone component that needs to be deployed in a way to access:
* Conductor server REST API
* Schellar REST API
* Keycloak REST API

and provides a unified REST API over all of these components.

There is no schema such as OpenAPI to describe workflow proxy. But since it copies underlying APIs, the documentation for them should be found here:
* https://github.com/FRINXio/schellar
* https://netflix.github.io/conductor/apispec/

> Example queries for the proxy can be found in [test-queries.rest](./test-queries.rest)

To start workflow proxy consult the scripts in `package.json`.

### Configuration

Default port for user facing proxy: **8088**, Env: `USER_FACING_PORT`

Default port for task proxy: **8089**, Env: `TASK_PROXY_PORT`

Default conductor URL to proxy: **http://conductor-server:8080**, Env: `PROXY_TARGET`

Default schellar URL to proxy: **http://schellar:3000**, Env: `SCHELLAR_TARGET`

Default url for querying keycloak in task proxy: **keycloak:8080**, Env: `KEYCLOAK_HOST`

Default client ID for querying keycloak in task proxy: **admin-cli**, Env: `KEYCLOAK_ADMIN_CLIENT_ID`

Default username for querying keycloak in task proxy: **admin**, Env: `KEYCLOAK_ADMIN_CLIENT_USERNAME`

Default password for querying keycloak in task proxy: **admin**, Env: `KEYCLOAK_ADMIN_CLIENT_PASSWORD`

Default user role to allow admin access in RBAC proxy: **OWNER**, Env: `ADMIN_ACCESS_ROLE`

Default user group to allow admin access in RBAC proxy: **NETWORK-ADMIN**, Env: `ADMIN_ACCESS_GROUP`

## Swagger UI 

OpenAPI documentation for workflow-proxy is accessible on route `/docs`.  <br>
Workflow-proxy support OAuth 2.0 Authorization with `authorizationCode flow`!

Read more about configuration on [Swagger Docs](https://swagger.io/docs/specification/authentication/oauth2/).

### Configuration

Enable/Disable oAuth2 authorization: Env: `OAUTH2`, default false

Identity platform authorize URL: **authorizationUrl**, Env: `OAUTH2_AUTH_URL`

Identity platform token URL: **tokenUrl**, Env: `OAUTH2_TOKEN_URL`

## Developer guide

Workflow proxy is one big http proxy component, relying mostly on `http-proxy` and `express` libraries.

Some useful pointers for developers:
* src/proxy/transformers/* - transformer functions that filter and modify requests/data to actually implement multitenancy, RBAC etc.
* src/proxy/transformers/```__tests__``` - unit tests for transformer functions
* src/proxy/transformer-registry - transformer function collector
* src/proxy/proxy - user facing proxy router
* src/task-proxy - task proxy router
* src/tenant-registry - keycloak client capable of providing all tenant IDs
* src/routes.js - conductor proxy

There is a Dockerfile to build a container image.

Workflow proxy can be run with nodemon for development purposes.
