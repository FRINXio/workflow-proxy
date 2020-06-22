# Workflow Proxy

The workflow proxy adds tenancy to Netflix Conductor. It implements the same API as conductor except it requires a tenant header in requests and makes sure that different tenants can't see each other's workflows.
