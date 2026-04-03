# Observability — TribeHub Backend

This document covers the three observability mechanisms active in the backend:
request tracing via a unique ID, structured HTTP logging, and a Prometheus
metrics scrape endpoint. The metrics endpoint is internal and intentionally
omitted from the public OpenAPI specification.

---

## Overview

| Mechanism | Implementation | Purpose |
|-----------|---------------|---------|
| Request ID | `RequestIdMiddleware` | Correlate all log lines of a single request |
| Structured logging | `LoggingInterceptor` | Single log line per request with key fields |
| Prometheus metrics | `MetricsController` + `MetricsService` | RED metrics + Node.js runtime stats |

---

## Request ID

Every request is assigned a unique identifier before it reaches any guard,
interceptor, or controller.

**Middleware:** `src/common/middleware/request-id.middleware.ts`

**Behaviour:**

- If the incoming request includes an `X-Request-Id` header with a non-empty
  string value, that value is reused as-is.
- Otherwise, a fresh UUID v4 is generated via Node.js `crypto.randomUUID()`.
- The resolved ID is attached to `req.requestId` so it is accessible
  throughout the request lifecycle.
- The same value is written to the `X-Request-Id` response header so clients
  can read it back.

**Propagation from the frontend:**

Send the header on outgoing requests:

```http
X-Request-Id: <uuid-v4>
```

If the header is omitted the server generates one automatically.

**Finding a request in logs:**

Every log line emitted by `LoggingInterceptor` includes the token
`requestId=<value>`. Search by that token in your log aggregator:

```
requestId=550e8400-e29b-41d4-a716-446655440000
```

---

## Structured Logging

**Interceptor:** `src/common/interceptors/logging.interceptor.ts`

The interceptor wraps every request and emits one log line when the response
is sent (or when an error is thrown). The line is written via NestJS `Logger`
which produces JSON-compatible structured output in production.

**Fields logged per request:**

| Field | Source | Example |
|-------|--------|---------|
| `method` | `req.method` | `GET` |
| `url` | `req.url` | `/api/v1/posts` |
| `statusCode` | `res.statusCode` (success) or `err.status` (error, falls back to `500`) | `200` |
| `duration` | `Date.now()` delta in milliseconds | `34ms` |
| `requestId` | `req.requestId` set by `RequestIdMiddleware` | `requestId=550e8400-...` |

**Log line format:**

```
[LoggingInterceptor] GET /api/v1/posts 200 34ms requestId=550e8400-e29b-41d4-a716-446655440000
```

Error paths use `logger.error()` instead of `logger.log()` and derive the
status code from the thrown exception object (`err.status`), defaulting to
`500` when the field is absent.

---

## Metrics Endpoint

### URL structure

The endpoint is intentionally not at the standard `/metrics` path. The full
path is built at runtime from the `METRICS_PATH_SECRET` environment variable:

```
GET /api/v1/_internal/<METRICS_PATH_SECRET>-metrics
```

Example with the placeholder value from `.env.example`:

```
GET /api/v1/_internal/_internal_metrics_72a4b8-metrics
```

Replace `_internal_metrics_72a4b8` with the actual value of `METRICS_PATH_SECRET`
in your environment.

### Double-defence authentication

Access is controlled by two independent checks applied in sequence:

1. **Basic Auth (middleware layer)** — `MetricsAuthMiddleware` runs before the
   controller and validates the `Authorization: Basic <base64>` header against
   `METRICS_USER` and `METRICS_PASS`. If the environment variables are not set
   the middleware rejects every request with `503`. On a credential mismatch it
   responds `401` and sets `WWW-Authenticate: Basic realm="Metrics"`.

2. **Secret path segment (controller layer)** — `MetricsController` extracts
   the `:secret` segment from the URL and compares it to `METRICS_PATH_SECRET`.
   If they do not match, or if `METRICS_PATH_SECRET` is not defined, the
   controller responds `404`. This second check prevents accidental exposure if
   the middleware is ever misconfigured or bypassed.

A scraper must satisfy both checks to receive metric data.

### Required environment variables

| Variable | Description |
|----------|-------------|
| `METRICS_USER` | Username for Basic Auth on the metrics endpoint |
| `METRICS_PASS` | Password for Basic Auth on the metrics endpoint |
| `METRICS_PATH_SECRET` | Secret string embedded in the metrics URL path |

All three variables are required. Missing any one of them causes the endpoint
to be unavailable (`503` or `404`).

Use unpredictable values in staging and production. The placeholder values in
`.env.example` must never be used outside local development.

### Exposed metrics

**Custom HTTP metrics** (registered in `MetricsService`):

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total HTTP requests received |
| `http_request_duration_seconds` | Histogram | `method`, `route` | Request duration in seconds |

Histogram buckets (seconds): `0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5`

Route labels are normalised to avoid high cardinality: UUID segments and
numeric ID segments in the path are replaced with `:id` before being used as
label values (e.g. `/api/v1/users/abc-123` becomes `/api/v1/users/:id`).

All custom metrics carry the `environment` label (value of `NODE_ENV`) via
`collectDefaultMetrics`.

**Default Node.js process metrics** (collected automatically by `prom-client`):

`prom-client`'s `collectDefaultMetrics()` is called on module init and adds
the standard process-level metrics, including:

- Event loop lag (`nodejs_eventloop_lag_seconds`)
- Active handles and requests
- Heap and resident set size (`nodejs_heap_size_*`, `process_resident_memory_bytes`)
- Garbage collection duration (`nodejs_gc_duration_seconds`)
- File descriptor count (`process_open_fds`)
- CPU usage (`process_cpu_seconds_total`)

### Response format

On success the endpoint returns raw Prometheus text exposition format:

```
Content-Type: text/plain; version=0.0.4; charset=utf-8
HTTP 200 OK
```

The body is plain text, not JSON. Configure your Prometheus scraper accordingly.

### Do not add to the public OpenAPI spec

The metrics endpoint is an internal operational endpoint protected by a secret
path and Basic Auth. It must not appear in `docs/openapi/` or any
publicly-distributed API schema. Adding it to the OpenAPI spec would reveal
the path structure and undermine the secret-path defence layer.

### Prometheus scrape job

Add a job to your `prometheus.yml`. Replace the bracketed placeholders with
actual environment values:

```yaml
scrape_configs:
  - job_name: tribehub-backend
    scheme: https
    metrics_path: /api/v1/_internal/[METRICS_PATH_SECRET]-metrics
    basic_auth:
      username: [METRICS_USER]
      password: [METRICS_PASS]
    static_configs:
      - targets:
          - your-backend-host.railway.app
```

---

## Local Testing

Verify the endpoint is reachable from a local dev server. Use the values from
your `.env` file:

```bash
# Build the Basic Auth token
echo -n "metrics_user:metrics_pass_changeme" | base64
# -> bWV0cmljc191c2VyOm1ldHJpY3NfcGFzc19jaGFuZ2VtZQ==

# Scrape metrics
curl -i \
  -H "Authorization: Basic bWV0cmljc191c2VyOm1ldHJpY3NfcGFzc19jaGFuZ2VtZQ==" \
  "http://localhost:3000/api/v1/_internal/_internal_metrics_72a4b8-metrics"
```

Alternatively, pass credentials directly (curl encodes them automatically):

```bash
curl -i \
  --user "metrics_user:metrics_pass_changeme" \
  "http://localhost:3000/api/v1/_internal/_internal_metrics_72a4b8-metrics"
```

Expected response on success:

```
HTTP/1.1 200 OK
Content-Type: text/plain; version=0.0.4; charset=utf-8

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/v1/_internal/:secret-metrics",status_code="200",...} 1
...
```

Expected response when `METRICS_USER` or `METRICS_PASS` are not set:

```
HTTP/1.1 503 Service Unavailable
{"message":"Metrics endpoint is not configured on this server."}
```

Expected response on wrong credentials:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="Metrics"
{"message":"Unauthorized"}
```

Expected response on wrong path secret:

```
HTTP/1.1 404 Not Found
```
