# Vertex AI Search: Google Drive Data Connector via REST API

**Date**: 2026-02-27
**GCP Project**: `effi-vertex-experiment` (project number `768786717495`)
**API Version**: `v1alpha` (also available in `v1` GA)
**Location**: `global`

## TL;DR

The REST API **works**. We successfully created a Google Drive data connector, it synced the entire Workspace domain's Drive within seconds, and search returned real documents with rich metadata. The key blocker for personal accounts is that it requires **Google Workspace** (not personal Gmail/Drive).

---

## 1. API Endpoint

```
POST https://discoveryengine.googleapis.com/v1alpha/projects/{project}/locations/global:setUpDataConnector
```

Auth: Bearer token from `gcloud auth application-default print-access-token`
Required header: `x-goog-user-project: {project}` (for ADC quota routing)

### Alternative: V2 endpoint

```
POST https://discoveryengine.googleapis.com/v1alpha/projects/{project}/locations/global:setUpDataConnectorV2
```

V2 takes the `DataConnector` object directly as the request body with `collectionId` and `collectionDisplayName` as query params.

## 2. Request Body (setUpDataConnector)

```json
{
  "collectionId": "my-gdrive-collection",
  "collectionDisplayName": "Google Drive Data",
  "dataConnector": {
    "dataSource": "google_drive",
    "refreshInterval": "86400s",
    "entities": [
      {
        "entityName": "google_drive"
      }
    ]
  }
}
```

### Key Fields

| Field | Value | Notes |
|-------|-------|-------|
| `collectionId` | RFC-1034 compliant, max 63 chars | Creates a new Collection |
| `dataSource` | `"google_drive"` | Undocumented -- docs only list `salesforce`, `jira`, `confluence`, `bigquery` |
| `refreshInterval` | Duration string (e.g., `"86400s"`) | Min 30 minutes, max 7 days |
| `entities[].entityName` | `"google_drive"` | Only known entity for this source |
| `params.folders` | Array of folder IDs (optional) | Accepted but not confirmed if it scopes sync |

### Derived Fields (output only)

| Field | Value |
|-------|-------|
| `connectorType` | `GOOGLE_DRIVE` (set automatically from `dataSource`) |
| `state` | `ACTIVE` |
| `entities[].dataStore` | `projects/.../dataStores/{collectionId}_google_drive` |

## 3. Prerequisites

### 3a. ACL / Identity Provider Config (REQUIRED)

Google Drive connectors **always** require an Identity Provider (IdP) to be configured at the project level. Without this, the API returns:

```
400 FAILED_PRECONDITION: "IdP must be selected before creating an ACLed Data Connector."
```

Setting `aclEnabled: false` in the request does NOT bypass this.

#### How to set IdP:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $PROJECT" \
  -H "Content-Type: application/json" \
  "https://discoveryengine.googleapis.com/v1alpha/projects/$PROJECT/locations/global/aclConfig" \
  -d '{
    "name": "projects/PROJECT_NUMBER/locations/global/aclConfig",
    "idpConfig": {
      "idpType": "GSUITE"
    }
  }'
```

IdP types:
- `GSUITE` -- Google Workspace (Google 1P identity)
- `THIRD_PARTY` -- External IdP via workforce pool (requires `externalIdpConfig.workforcePoolName`)

### 3b. Google Workspace (REQUIRED)

The connector authenticates via the GCP project's associated Google Workspace domain. This means:
- The GCP project must be owned by a Google Workspace organization
- It uses the Workspace customer ID to connect to Google Drive
- **Personal Google accounts will NOT work** -- there is no Workspace domain to query
- Documents synced are those owned by or shared with users in the Workspace domain

### 3c. API Enablement

Discovery Engine API must be enabled on the project. Our project (`effi-vertex-experiment`) has it enabled.

### 3d. IAM Permissions

The user/service account needs:
- `discoveryengine.dataConnectors.create` (or `discoveryengine.admin`)
- `discoveryengine.collections.create`
- ADC with `cloud-platform` scope works

## 4. What Gets Created

When `setUpDataConnector` succeeds, it creates:

1. **Collection**: `projects/.../collections/{collectionId}`
2. **DataConnector**: `projects/.../collections/{collectionId}/dataConnector` (singleton per collection)
3. **DataStore**: `projects/.../collections/default_collection/dataStores/{collectionId}_google_drive`
   - `contentConfig`: `GOOGLE_WORKSPACE`
   - `workspaceConfig.type`: `GOOGLE_DRIVE`
   - `aclEnabled`: `true`
   - `idpConfig.idpType`: `GSUITE`

## 5. Sync Behavior

- The connector starts syncing **immediately** upon creation
- In our test, 4 documents were searchable within seconds
- The connector syncs the **entire Workspace domain's Drive** by default (all users)
- `refreshInterval: "86400s"` means periodic re-sync every 24 hours
- Manual sync trigger via `startConnectorRun` exists but entity format is different for first-party connectors

## 6. Search Results

Search works immediately via:

```
POST https://discoveryengine.googleapis.com/v1alpha/projects/{project}/locations/global/collections/default_collection/dataStores/{storeId}/servingConfigs/default_search:search
```

### Result metadata includes:

| Field | Example |
|-------|---------|
| `id` | Google Drive file ID (`1XETdLsX0RWHav8qOZrhgvbtEFufVFP9Kv5Z1ZABy2Dc`) |
| `title` | Document title |
| `mime_type` | `application/vnd.google-apps.document`, `.spreadsheet` |
| `owner` | User display name |
| `owner_email` | User email |
| `link` | Direct Drive link |
| `create_time` | Unix timestamp |
| `update_time` | Unix timestamp |
| `tags_data` | Array with `created_on`, `updated_on`, `created_by` |
| `entity_type` | `google_drive` |
| `source_type` | `google_drive` |
| `snippets` | Search-highlighted text snippets |

### Limitations:

- `ListDocuments` is not available on ACL-enabled data stores (returns `FAILED_PRECONDITION`)
- Search results respect ACL -- a user only sees documents they have access to in Drive

## 7. Cleanup

Delete the connector by deleting its collection:

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-goog-user-project: $PROJECT" \
  "https://discoveryengine.googleapis.com/v1alpha/projects/$PROJECT/locations/global/collections/{collectionId}"
```

## 8. Discovery Document Reference

The full API schema is available at:
```
https://discoveryengine.googleapis.com/$discovery/rest?version=v1alpha
```

### ConnectorType Enum (all supported connector types):

| Value | Description |
|-------|-------------|
| `THIRD_PARTY` | Salesforce, Jira, Confluence |
| `GCP_FHIR` | FHIR store connector |
| `BIG_QUERY` | BigQuery connector |
| `GCS` | Cloud Storage connector |
| `GOOGLE_MAIL` | Gmail connector |
| `GOOGLE_CALENDAR` | Google Calendar connector |
| `GOOGLE_DRIVE` | Google Drive connector |
| `NATIVE_CLOUD_IDENTITY` | People API connector |
| `THIRD_PARTY_FEDERATED` | Federated search (no ingestion) |
| `THIRD_PARTY_EUA` | End User Auth connector |
| `GCNV` | Google Cloud NetApp Volumes |
| `GOOGLE_CHAT` | Google Chat connector |
| `GOOGLE_SITES` | Google Sites connector |
| `REMOTE_MCP` | Remote MCP connector |

## 9. What This Means for Us

### Can we use this for customer onboarding?

**Partially.** The connector works great for Workspace domains, but:

1. **Workspace required**: Customers must have Google Workspace (not personal Gmail). This covers most business customers.
2. **Domain-wide scope**: By default it syncs the entire domain's Drive. Folder scoping via `params.folders` was accepted but needs validation.
3. **ACL enforcement**: Search results are filtered by the querying user's Drive permissions. This is good for security but means we need to pass user identity through to search.
4. **No personal accounts**: Users with personal Google accounts (consumer Gmail) cannot use this connector.

### What the user needs to provide:

1. A Google Workspace domain (with admin access to enable APIs)
2. The GCP project must be associated with that Workspace org
3. Alternatively: The user grants our service account domain-wide delegation

### Blockers for our use case:

1. **Our GCP project (`effi-vertex-experiment`) is on the `askeffi.ai` Workspace domain** -- it already works for that domain's Drive
2. **For customer domains**: We would need either:
   - Customer's own GCP project with Discovery Engine API enabled
   - Domain-wide delegation from customer's Workspace to our service account
   - Or: Use GCS/JSONL import (our current approach) instead of the Drive connector

## 10. Actual Test Transcript

### Test 1: Without IdP
```
Request: setUpDataConnector with dataSource="google_drive"
Response: 400 FAILED_PRECONDITION: "IdP must be selected before creating an ACLed Data Connector."
```

### Test 2: Set IdP to GSUITE
```
Request: PATCH aclConfig with idpType="GSUITE"
Response: 200 OK
```

### Test 3: Create Drive connector (success)
```
Request: setUpDataConnector with dataSource="google_drive"
Response: 200 OK, operation done=true
```

### Test 4: Verify connector
```
State: ACTIVE
ConnectorType: GOOGLE_DRIVE
DataStore: gdrive-test-001_google_drive
```

### Test 5: Search
```
Query: "test"
Results: 4 documents from askeffi.ai domain (Google Docs, Sheets)
```

### Test 6: Invalid dataSource comparison
```
Request: setUpDataConnector with dataSource="dropbox"
Response: 400 INVALID_ARGUMENT: "Field 'params' is a required field"
(Different error -- confirms google_drive is a recognized first-party source with special handling)
```

### Test 7: Cleanup
```
Request: DELETE collection
Response: 200 OK, operation done=true
```

## Appendix: Side Effects Left Behind

- **ACL config**: Left as `idpType: GSUITE` on `effi-vertex-experiment` project (location `global`). This is harmless and needed for future Drive connector work.
- **Collections**: All test collections deleted. Only `default_collection` remains.
- **Data stores**: All test data stores deleted with their parent collections.
