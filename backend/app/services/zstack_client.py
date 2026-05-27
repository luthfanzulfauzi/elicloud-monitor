"""
ZStack API client — READ-ONLY.
Only GET methods are used. No POST/PUT/DELETE to ZStack resources.

Authentication: AccessKey (HMAC-SHA1).
- Authorization: ZStack <AccessKeyID>:<Base64(HMAC-SHA1(secret, "METHOD\nDate\n/v1/path"))>
- Date header: RFC 1123 GMT  (must not drift >15 min from server)
- URI for signing: /v1/<path>  — no /zstack prefix, no query string
- Actual request URL: <endpoint>/zstack/v1/<path>
"""
import base64
import hashlib
import hmac
import logging
import urllib.parse
from email.utils import formatdate

import httpx

from ..config import settings

log = logging.getLogger(__name__)

PAGE_SIZE = 1000


def _make_auth(method: str, uri: str) -> tuple[str, str]:
    """Return (Authorization header value, Date header value) for one request."""
    date_str = formatdate(usegmt=True)
    sig_str = f"{method}\n{date_str}\n{uri}"
    mac = hmac.new(
        settings.ZSTACK_ACCESS_KEY_SECRET.encode(),
        sig_str.encode(),
        hashlib.sha1,
    )
    signature = base64.b64encode(mac.digest()).decode()
    return f"ZStack {settings.ZSTACK_ACCESS_KEY_ID}:{signature}", date_str


async def _query_all(path: str, extra_params: dict | None = None) -> list[dict]:
    """Paginate through a ZStack Query API. Returns all inventories."""
    base_url = settings.ZSTACK_ENDPOINT.rstrip("/")
    uri = f"/v1/{path}"
    url = f"{base_url}/zstack{uri}"
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:
        start = 0
        while True:
            auth, date_str = _make_auth("GET", uri)
            params: dict = {"start": start, "limit": PAGE_SIZE, "replyWithCount": "true"}
            if extra_params:
                params.update(extra_params)
            headers = {
                "Authorization": auth,
                "Date": date_str,
                "Content-Type": "application/json",
            }
            try:
                resp = await client.get(url, params=params, headers=headers)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.error("ZStack GET %s failed: %s", url, exc)
                raise

            data = resp.json()
            inventories = data.get("inventories") or data.get("inventory", [])
            if isinstance(inventories, dict):
                inventories = [inventories]
            results.extend(inventories)

            total = data.get("total", len(results))
            start += PAGE_SIZE
            if start >= total:
                break

    return results


async def fetch_hosts() -> list[dict]:
    return await _query_all("hosts")


async def fetch_primary_storage() -> list[dict]:
    return await _query_all("primary-storage")


async def fetch_vms() -> list[dict]:
    return await _query_all("vm-instances")


async def fetch_volumes() -> list[dict]:
    return await _query_all("volumes")


async def fetch_eips() -> list[dict]:
    return await _query_all("eips")


async def fetch_projects() -> list[dict]:
    return await _query_all("iam2/projects")


async def fetch_vms_for_project(project_uuid: str) -> list[str]:
    """Return VM UUIDs belonging to an IAM2 project. Uses short timeout — returns [] on any failure.

    Note: the q= condition uses literal `=` which must NOT be URL-encoded, so the URL is
    built as a string rather than via httpx params dict (which would encode `=` to `%3D`).
    """
    base_url = settings.ZSTACK_ENDPOINT.rstrip("/")
    uri = "/v1/vm-instances"
    results: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            start = 0
            while True:
                auth, date_str = _make_auth("GET", uri)
                # Build URL manually to preserve literal `=` in the ZStack query condition
                full_url = (
                    f"{base_url}/zstack{uri}"
                    f"?q=__projectUuid__={project_uuid}"
                    f"&start={start}&limit={PAGE_SIZE}&replyWithCount=true"
                )
                headers = {"Authorization": auth, "Date": date_str, "Content-Type": "application/json"}
                resp = await client.get(full_url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                inventories = data.get("inventories", [])
                results.extend(v["uuid"] for v in inventories if "uuid" in v)
                total = data.get("total", len(results))
                start += PAGE_SIZE
                if start >= total:
                    break
    except Exception as exc:
        log.debug("fetch_vms_for_project %s failed: %s", project_uuid, exc)
    return results


async def fetch_accounts() -> list[dict]:
    return await _query_all("accounts")


async def fetch_quotas_for_account(account_uuid: str) -> dict[str, int]:
    """Return a name→value map of quotas for one account (project's linkedAccountUuid).

    Builds URL manually to preserve literal `=` in the ZStack query condition.
    Returns {} on any failure.
    """
    base_url = settings.ZSTACK_ENDPOINT.rstrip("/")
    uri = "/v1/accounts/quotas"
    url = f"{base_url}/zstack{uri}"
    results: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            start = 0
            while True:
                auth, date_str = _make_auth("GET", uri)
                full_url = (
                    f"{url}?q=identityUuid={account_uuid}"
                    f"&start={start}&limit={PAGE_SIZE}&replyWithCount=true"
                )
                headers = {"Authorization": auth, "Date": date_str, "Content-Type": "application/json"}
                resp = await client.get(full_url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                inventories = data.get("inventories", [])
                results.extend(inventories)
                total = data.get("total", len(results))
                start += PAGE_SIZE
                if start >= total:
                    break
    except Exception as exc:
        log.debug("fetch_quotas_for_account %s failed: %s", account_uuid, exc)
        return {}
    return {q["name"]: q["value"] for q in results if "name" in q and "value" in q}


async def fetch_vm_owner_refs() -> dict[str, str]:
    """Return {vm_zstack_uuid: owner_account_uuid} for all VMs via ZQL accountresourceref.

    ZStack REST API does not expose account ownership on VmInstanceInventory.
    ZQL's accountresourceref table (AccountResourceRefVO) does contain ownerAccountUuid
    per resource. We fetch all refs, filter client-side for VmInstanceVO + isShared=false,
    and return the mapping used to populate vm.project_id during sync.
    """
    base_url = settings.ZSTACK_ENDPOINT.rstrip("/")
    uri = "/v1/zql"
    url = f"{base_url}/zstack{uri}"
    result: dict[str, str] = {}
    offset = 0

    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            zql = f"query accountresourceref limit {PAGE_SIZE} offset {offset}"
            encoded = urllib.parse.quote(zql)
            auth, date_str = _make_auth("GET", uri)
            headers = {"Authorization": auth, "Date": date_str, "Content-Type": "application/json"}
            try:
                resp = await client.get(f"{url}?zql={encoded}", headers=headers)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.error("ZQL accountresourceref failed: %s", exc)
                raise

            inventories = resp.json().get("results", [{}])[0].get("inventories", [])
            for ref in inventories:
                if ref.get("resourceType") == "VmInstanceVO" and not ref.get("isShared"):
                    result[ref["resourceUuid"]] = ref["ownerAccountUuid"]

            offset += PAGE_SIZE
            if len(inventories) < PAGE_SIZE:
                break

    return result


async def fetch_user_tags() -> list[dict]:
    """Fetch user tags scoped to VmInstanceVO resources."""
    base_url = settings.ZSTACK_ENDPOINT.rstrip("/")
    uri = "/v1/user-tags"
    url = f"{base_url}/zstack{uri}"
    results: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:
        start = 0
        while True:
            auth, date_str = _make_auth("GET", uri)
            params = {
                "q": "resourceType=VmInstanceVO",
                "start": start,
                "limit": PAGE_SIZE,
                "replyWithCount": "true",
            }
            headers = {
                "Authorization": auth,
                "Date": date_str,
                "Content-Type": "application/json",
            }
            try:
                resp = await client.get(url, params=params, headers=headers)
                resp.raise_for_status()
            except httpx.HTTPError as exc:
                log.error("ZStack GET user-tags failed: %s", exc)
                raise
            data = resp.json()
            items = data.get("inventories", [])
            results.extend(items)
            total = data.get("total", len(results))
            start += PAGE_SIZE
            if start >= total:
                break

    return results
