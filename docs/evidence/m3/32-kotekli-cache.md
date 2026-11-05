# M3 Evidence — Kötekli Report Cache (#32)

- **Test date:** 5 November 2026
- **Tested commit:** `32e60a2` (`32-kotekli-report-cache`)
- **Endpoint:** `GET /api/v1/neighborhoods/kotekli/report`
- **Environment:** Local Uvicorn server with a fresh SQLite database and report caching enabled.

| Request | HTTP status | `X-Cache` | `X-Cache-Hits` | Elapsed time |
| --- | --- | --- | ---: | ---: |
| First request | `200 OK` | `MISS` | 0 | 20.434 ms |
| Second request | `200 OK` | `HIT` | 1 | 3.582 ms |

The first request built the report from the saved Kötekli pilot data. The second request served the cached report and incremented the hit counter. These timings describe one local test run. Live Gemini generation and pre-generating reports before the first request were outside the scope of this test.

## Terminal output (excerpt)

```text
HTTP/1.1 200 OK
x-cache: MISS
x-cache-hits: 0
Süre: 0.020434s

HTTP/1.1 200 OK
x-cache: HIT
x-cache-hits: 1
Süre: 0.003582s
```

## Reproduce

From the repository root, run the backend with its dependencies installed:

```bash
cd backend
run_dir=$(mktemp -d)
DATABASE_URL="sqlite:///$run_dir/kotekli.db" REPORT_CACHE_ENABLED=true \
  python -m uvicorn app.main:app --host 127.0.0.1 --port 18332
```

In a second terminal, send two identical requests:

```bash
for i in 1 2; do
  curl -fsS -D - -o /dev/null -w 'Süre: %{time_total}s\n' \
    http://127.0.0.1:18332/api/v1/neighborhoods/kotekli/report
done
```

## Authorized Gemini refresh

Tested on 5 November 2026 on `32-kotekli-report-cache` using FastAPI's HTTP test client, isolated SQLite, and a simulated Gemini SDK response. The request passed through the application's Gemini integration, including prompt serialization and response validation.

| Scenario | HTTP status | Cache result |
| --- | --- | --- |
| Normal request on an empty cache | 200 | `MISS`, hits 0. Returned the local Kötekli pilot report. |
| Refresh without the operator token | 403 | No Gemini call. |
| Authorized refresh with valid Gemini narrative | 200 | `MISS`, hits 0. Stored the new report. |
| Normal request after refresh | 200 | `HIT`, hits 1. Returned the same report as the refresh. |
| Authorized refresh with a provider timeout or invalid output | 502 | Returned an error. The cached report was preserved. |
| Normal request after the failure | 200 | `HIT`, hits 2. Returned the last valid Gemini report unchanged. |

The test inspected the serialized prompt for the pilot reference date (`2026-10-28`), saved source records and links, existing scores, and unknown values. The refreshed response preserved all structured report fields, including scores, source links, and missing values. The app also kept the pilot date in the narrative heading. The test covered a timeout and a malformed model response in separate runs.

From `backend/`, run the automated scenarios with the development dependencies installed:

```bash
python -m pytest -q tests/test_api.py tests/test_caching.py
```

**Live verification pending.** No Gemini key or model was configured for this run. To verify against Gemini, start the API with report caching enabled and set `GEMINI_API_KEY`, `GEMINI_MODEL`, and a server-side `AI_REFRESH_TOKEN` of at least 32 characters. Send an authorized `GET /api/v1/neighborhoods/kotekli/report?refresh_ai=true` with that token in the `X-AI-Refresh-Token` header. Then send a normal GET to the same report without the query parameter and check that it returns `HIT` with the same narrative.
