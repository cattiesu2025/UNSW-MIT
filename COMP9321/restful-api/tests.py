import os, time, sqlite3, requests

BASE = os.getenv("API_BASE", "http://127.0.0.1:5000")
DB   = f"app.sqlite"
RUN_SLOW = os.getenv("RUN_SLOW", "0") == "1"  # turn on heavier checks when set

AGENCY = os.getenv("TEST_AGENCY", "GSBC001")  # default target agency
CANDIDATES = ["GSBC001","GSBC002","GSBC003","GSBC004","SBSC006","GSBC007","GSBC008","GSBC009","GSBC010","GSBC014"]

# ----------------- helpers -----------------

def ok(msg: str):
    print(f"✅ {msg}")

def info(msg: str):
    print(f"ℹ️  {msg}")

def login(username="admin", password="admin"):
    r = requests.post(f"{BASE}/auth/login", json={"username": username, "password": password}, timeout=30)
    r.raise_for_status()
    token = r.json()["token"]
    return {"Authorization": token}  # server supports bare token in Authorization header

def get(url, headers=None, **params):
    return requests.get(f"{BASE}{url}", params=params, headers=headers, timeout=60)

def post(url, headers=None, **params):
    return requests.post(f"{BASE}{url}", headers=headers, timeout=180, **params)

# DB sanity helpers (optional checks)

def _count(table, agency):
    key = f"buses:{agency}"
    with sqlite3.connect(DB) as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {table} WHERE agency_key=?", (key,))
        return cur.fetchone()[0]

# ----------------- tests -----------------

def test_set1_user_management_and_roles():
    """Set 1: login, role-based access, user lifecycle (add/activate/deactivate/delete)."""
    print("\n===== Set 1 – User Management & Roles =====")
    # Admin can list users
    h_admin = login("admin", "admin")
    r = get("/admin/users", headers=h_admin)
    assert r.status_code == 200, f"admin list users failed: {r.status_code} {r.text}"
    ok("Admin can list users (200)")
    users = r.json()

    # Admin can create planner/commuter; duplicate username should fail
    import time as _t
    uname = f"plan_{int(_t.time())%100000}"
    payload = {"username": uname, "password": "pw", "role": "planner"}
    r = post("/admin/users", headers=h_admin, json=payload)
    assert r.status_code == 201, f"admin create planner failed: {r.status_code} {r.text}"
    ok("Admin creates planner (201)")
    new_user = r.json(); uid = new_user["id"]

    r = post("/admin/users", headers=h_admin, json=payload)  # duplicate
    assert r.status_code == 400, "duplicate username should return 400"
    ok("Duplicate username rejected (400)")

    # Planner cannot manage users (403)
    h_planner = login(uname, "pw")
    r = get("/admin/users", headers=h_planner)
    assert r.status_code == 403, f"planner must not list users, got {r.status_code}"
    ok("Planner cannot list users (403)")

    # Commuter cannot manage users (403)
    h_commuter = login("commuter", "commuter")
    r = get("/admin/users", headers=h_commuter)
    assert r.status_code == 403, f"commuter must not list users, got {r.status_code}"
    ok("Commuter cannot list users (403)")

    # Admin can deactivate the planner; then any protected endpoint should give 403
    r = requests.patch(f"{BASE}/admin/users/{uid}", json={"active": False}, headers=h_admin, timeout=30)
    assert r.status_code == 200, f"admin deactivate failed: {r.status_code} {r.text}"
    ok("Admin deactivates planner (200)")

    # Deactivated user hits a protected endpoint -> 403 (regardless of agency import state)
    r = get("/gtfs/routes", headers=h_planner, agency="GSBC001")
    assert r.status_code == 403, f"deactivated user should get 403, got {r.status_code}"
    ok("Deactivated user blocked on protected endpoint (403)")

    # Reactivate; the same call should no longer be 403 (could be 200 or 404 depending on import state)
    r = requests.patch(f"{BASE}/admin/users/{uid}", json={"active": True}, headers=h_admin, timeout=30)
    assert r.status_code == 200, f"admin reactivate failed: {r.status_code} {r.text}"
    ok("Admin reactivates planner (200)")
    r = get("/gtfs/routes", headers=h_planner, agency="GSBC001")
    assert r.status_code in (200, 404), f"reactivated user should pass auth, got {r.status_code}"
    ok("Reactivated user passes auth (200/404)")

    # Admin can delete the test user (but not the built-in admin)
    r = requests.delete(f"{BASE}/admin/users/{uid}", headers=h_admin, timeout=30)
    assert r.status_code == 200, f"admin delete failed: {r.status_code} {r.text}"
    ok("Admin deletes test user (200)")
    print("Set 1 checks passed ✅")


def _ensure_imported(agency: str, h_reader, h_planner):
    """Helper: ensure the given agency is imported; return True if we had to import."""
    r = get("/gtfs/routes", headers=h_reader, agency=agency)
    if r.status_code == 404:
        r2 = post(f"/gtfs/import/buses/{agency}", headers=h_planner)
        assert r2.status_code == 200, f"failed to import {agency}: {r2.status_code} {r2.text}"
        time.sleep(0.3)
        return True
    assert r.status_code in (200,404), r.status_code
    return False


def test_set2_import_only():
    print("\n===== Set 2 – Importing Bus Agency Data =====")
    h_reader = login("commuter", "commuter")

    # Find a not-yet-imported agency for 404 precondition if possible
    global AGENCY
    preimported = False
    for cand in [AGENCY] + [a for a in CANDIDATES if a != AGENCY]:
        res = get("/gtfs/routes", headers=h_reader, agency=cand)
        if res.status_code == 404:
            AGENCY = cand
            break
        elif res.status_code == 200:
            preimported = True
            continue
        else:
            break
    else:
        preimported = True

    r = get("/gtfs/routes", headers=h_reader, agency=AGENCY)
    if preimported and r.status_code == 200:
        info(f"{AGENCY} already imported, skipping 404 precondition.")
    else:
        assert r.status_code == 404, f"expected 404 before import, got {r.status_code}: {r.text}"
        ok("Pre-import query returns 404 (not imported)")

    # planner imports; commuter forbidden
    h_planner = login("planner", "planner")
    r = post(f"/gtfs/import/buses/{AGENCY}", headers=h_planner)
    assert r.status_code == 200, f"import failed: {r.status_code} {r.text}"
    ok("Planner imports agency (200)")

    r = post(f"/gtfs/import/buses/{AGENCY}", headers=h_reader)
    assert r.status_code in (401,403), r.status_code
    ok("Commuter cannot import (401/403)")

    if RUN_SLOW:
        routes_before = _count("gtfs_routes", AGENCY)
        stops_before  = _count("gtfs_stops",  AGENCY)
        r = post(f"/gtfs/import/buses/{AGENCY}", headers=h_planner)
        assert r.status_code == 200, r.text
        time.sleep(0.3)
        routes_after = _count("gtfs_routes", AGENCY)
        stops_after  = _count("gtfs_stops",  AGENCY)
        assert routes_after >= routes_before and stops_after >= stops_before
        ok("Re-import does not reduce row counts")

    print("Set 2 checks passed ✅")

def test_set3_data_access():
    print("\n===== Set 3 – Data Access =====")
    # three roles: all should be able to read
    h_commuter = login("commuter", "commuter")
    h_planner  = login("planner",  "planner")
    h_admin    = login("admin",    "admin")

    # ensure data exists (use planner to import if needed)
    _ensure_imported(AGENCY, h_commuter, h_planner)

    def _route_get_by_id(route_id, h):
        # Prefer RESTful /gtfs/routes/<id>; fall back to filter if not supported
        r = get(f"/gtfs/routes/{route_id}", headers=h)
        if r.status_code == 200:
            data = r.json(); assert data.get("route_id") == route_id, data
            return
        # fallback
        r = get("/gtfs/routes", headers=h, agency=AGENCY, route_id=route_id)
        jr = r.json(); assert r.status_code == 200 and jr.get("total", 0) >= 1, jr

    def _trip_get_by_id(trip_id, h):
        r = get(f"/gtfs/trips/{trip_id}", headers=h)
        if r.status_code == 200:
            data = r.json(); assert data.get("trip_id") == trip_id, data
            return
        r = get("/gtfs/trips", headers=h, agency=AGENCY, trip_id=trip_id)
        jt = r.json(); assert r.status_code == 200 and jt.get("total", 0) >= 1, jt

    def _stop_get_by_id(stop_id, h):
        r = get(f"/gtfs/stops/{stop_id}", headers=h)
        if r.status_code == 200:
            data = r.json(); assert data.get("stop_id") == stop_id, data
            return
        r = get("/gtfs/stops", headers=h, agency=AGENCY, stop_id=stop_id)
        js = r.json(); assert r.status_code == 200 and js.get("total", 0) >= 1, js

    for role_name, H in [("Admin", h_admin), ("Planner", h_planner), ("Commuter", h_commuter)]:
        # 1) all routes for an agency (paged)
        r = get("/gtfs/routes", headers=H, agency=AGENCY, page=1, page_size=5)
        jr = r.json(); assert r.status_code == 200 and jr["total"] > 0 and len(jr["items"]) <= 5, jr
        ok(f"{role_name}: list routes by agency with pagination (200, items<=5)")

        # 2) all trips for a specific route (paged)
        seed_route = jr["items"][0]["route_id"] if jr["items"] else None
        r = get("/gtfs/trips", headers=H, agency=AGENCY, route_id=seed_route, page=1, page_size=5)
        jt = r.json(); assert r.status_code == 200 and len(jt["items"]) <= 5, jt
        ok(f"{role_name}: list trips for a route with pagination (200, items<=5)")

        # 3) all stops for a specific trip (paged)
        seed_trip = jt["items"][0]["trip_id"] if jt["items"] else None
        r = get("/gtfs/stops", headers=H, agency=AGENCY, trip_id=seed_trip, page=1, page_size=5)
        js = r.json(); assert r.status_code == 200 and len(js["items"]) <= 5, js
        ok(f"{role_name}: list stops for a trip with pagination (200, items<=5)")

        # 4) retrieve single entities by id (route/trip/stop)
        if seed_route:
            _route_get_by_id(seed_route, H)
            ok(f"{role_name}: get route by id (200)")
        if seed_trip:
            _trip_get_by_id(seed_trip, H)
            ok(f"{role_name}: get trip by id (200)")
        if js["items"]:
            seed_stop = js["items"][0]["stop_id"]
            _stop_get_by_id(seed_stop, H)
            ok(f"{role_name}: get stop by id (200)")

    # bad params still apply
    r = get("/gtfs/routes", headers=h_commuter, agency=AGENCY, route_type="abc")
    assert r.status_code == 400, r.status_code
    ok("Invalid route_type returns 400")

    print("Set 3 checks passed ✅")

def test_set4_exploring_stops():
    print("\n===== Set 4 – Exploring Stops =====")
    h_commuter = login("commuter", "commuter")
    h_planner  = login("planner",  "planner")
    h_admin    = login("admin",    "admin")

    _ensure_imported(AGENCY, h_commuter, h_planner)

    r = get("/gtfs/stops", headers=h_commuter, agency=AGENCY, page=1, page_size=10)
    js = r.json(); assert r.status_code == 200 and js["items"], js
    stop_name = js["items"][0]["stop_name"]
    token = stop_name[: max(2, len(stop_name)//3) ]

    for role_name, H in [("Admin", h_admin), ("Planner", h_planner), ("Commuter", h_commuter)]:
        # exact
        r = get("/gtfs/stops", headers=H, agency=AGENCY, q=stop_name, page_size=5)
        je = r.json(); assert r.status_code == 200 and len(je["items"]) >= 1, je
        ok(f"{role_name}: stop search by exact name returns >=1 result")

        # case-insensitive
        r = get("/gtfs/stops", headers=H, agency=AGENCY, q=stop_name.lower(), page_size=5)
        jl = r.json(); assert r.status_code == 200 and len(jl["items"]) >= 1, jl
        ok(f"{role_name}: stop search is case-insensitive")

        # partial
        r = get("/gtfs/stops", headers=H, agency=AGENCY, q=token, page_size=5)
        jp = r.json(); assert r.status_code == 200 and len(jp["items"]) >= 1, jp
        ok(f"{role_name}: stop search accepts partial matches")

    print("Set 4 checks passed ✅")


def test_set5_favourites():
    print("\n===== Set 5 – Favourite Routes =====")
    # three roles: everyone manages their own favourites
    h_commuter = login("commuter", "commuter")
    h_planner  = login("planner",  "planner")
    h_admin    = login("admin",    "admin")

    # Ensure we have data to pick route ids
    _ensure_imported(AGENCY, h_commuter, h_planner)
    r = get("/gtfs/routes", headers=h_commuter, agency=AGENCY, page=1, page_size=10)
    jr = r.json(); assert r.status_code == 200 and jr["items"], jr
    seed_routes = [it["route_id"] for it in jr["items"]][:3]
    assert len(seed_routes) >= 3, "Need at least 3 routes to test favourite limit"

    def reset_user(H):
        rr = get("/favorites", headers=H)
        if rr.status_code == 200:
            for it in rr.json()["items"]:
                requests.delete(f"{BASE}/favorites/{it['id']}", headers=H, timeout=30)

    def full_flow(role_name, H):
        reset_user(H)
        # Add first two favourites
        r1 = post("/favorites", headers=H, json={"agency": AGENCY, "route_id": seed_routes[0], "alias": "first"})
        assert r1.status_code == 201, (role_name, r1.status_code, r1.text)
        fav1 = r1.json()["id"]
        ok(f"{role_name}: add favourite #1 (201)")

        r2 = post("/favorites", headers=H, json={"agency": AGENCY, "route_id": seed_routes[1], "alias": "second"})
        assert r2.status_code == 201, (role_name, r2.status_code, r2.text)
        fav2 = r2.json()["id"]
        ok(f"{role_name}: add favourite #2 (limit=2) (201)")

        # Third should fail due to limit
        r3 = post("/favorites", headers=H, json={"agency": AGENCY, "route_id": seed_routes[2]})
        assert r3.status_code in (400, 409), (role_name, r3.status_code, r3.text)
        ok(f"{role_name}: add favourite over limit rejected (400/409)")

        # List should have 2
        rl = get("/favorites", headers=H)
        assert rl.status_code == 200 and len(rl.json()["items"]) == 2, (role_name, rl.status_code, rl.text)
        ok(f"{role_name}: list favourites returns 2 (200)")

        # Update alias of first favourite
        ru = requests.patch(f"{BASE}/favorites/{fav1}", json={"alias": "home"}, headers=H, timeout=30)
        assert ru.status_code == 200, (role_name, ru.status_code, ru.text)
        ok(f"{role_name}: update favourite alias (200)")

        # Verify alias changed
        rl2 = get("/favorites", headers=H)
        aliases = {it["id"]: it.get("alias") for it in rl2.json()["items"]}
        assert aliases.get(fav1) == "home", (role_name, aliases)

        # Delete one
        rd = requests.delete(f"{BASE}/favorites/{fav2}", headers=H, timeout=30)
        assert rd.status_code == 200, (role_name, rd.status_code, rd.text)
        ok(f"{role_name}: delete favourite (200)")

        # List should have 1 now
        rl3 = get("/favorites", headers=H)
        assert rl3.status_code == 200 and len(rl3.json()["items"]) == 1

        return fav1  # keep for cross-user authz test

    fav_id_commuter = full_flow("Commuter", h_commuter)

    # Cross-user: planner cannot delete commuter's favourite
    rd_x = requests.delete(f"{BASE}/favorites/{fav_id_commuter}", headers=h_planner, timeout=30)
    assert rd_x.status_code in (403, 404), rd_x.status_code
    ok("Cross-user delete blocked (403/404)")

    # Admin manages their own too (same logic)
    full_flow("Admin", h_admin)
    full_flow("Planner", h_planner)

    print("Set 5 checks passed ✅")

def test_set6_visual_and_export():
    print("\n===== Set 6 – Visualisation & Export (all users) =====")
    h_commuter = login("commuter", "commuter")
    h_planner  = login("planner",  "planner")
    h_admin    = login("admin",    "admin")

    _ensure_imported(AGENCY, h_commuter, h_planner)

    r = get("/gtfs/routes", headers=h_commuter, agency=AGENCY, page=1, page_size=10)
    jr = r.json(); assert r.status_code == 200 and jr["items"], jr
    routes = [it["route_id"] for it in jr["items"]][:3]
    assert len(routes) >= 2, "need >=2 routes to test visualisation"

    def reset_user(H):
        rr = get("/favorites", headers=H)
        if rr.status_code == 200:
            for it in rr.json()["items"]:
                requests.delete(f"{BASE}/favorites/{it['id']}", headers=H, timeout=30)

    def ensure_two_favourites(H, role_name):
        reset_user(H)
        r1 = post("/favorites", headers=H,
                  json={"agency": AGENCY, "route_id": routes[0], "alias": f"{role_name}-1"})
        assert r1.status_code == 201, (role_name, r1.status_code, r1.text)
        r2 = post("/favorites", headers=H,
                  json={"agency": AGENCY, "route_id": routes[1], "alias": f"{role_name}-2"})
        assert r2.status_code == 201, (role_name, r2.status_code, r2.text)

    for role_name, H in [("Commuter", h_commuter), ("Planner", h_planner), ("Admin", h_admin)]:
        ensure_two_favourites(H, role_name)

        # PNG
        r = get("/viz/map", headers=H)
        assert r.status_code == 200, f"{role_name} png {r.status_code} {r.text}"
        ctype = r.headers.get("Content-Type", "")
        assert "image/png" in ctype.lower(), (role_name, ctype)
        assert len(r.content) > 1024, (role_name, "png too small")
        ok(f"{role_name}: favourites visualised as PNG (inline)")

        # CSV 
        r = get("/viz/map", headers=H, format="csv")
        assert r.status_code == 200, f"{role_name} csv {r.status_code} {r.text}"
        ctype = r.headers.get("Content-Type", "")
        assert "text/csv" in ctype.lower(), (role_name, ctype)
        assert "route_id" in r.text and "stop_id" in r.text, (role_name, "csv headers missing")
        ok(f"{role_name}: favourites exported as CSV (inline)")

    r = get("/viz/map", headers=h_commuter, agency=AGENCY, route_id=routes[0])
    assert r.status_code == 200 and "image/png" in r.headers.get("Content-Type","").lower()
    ok("Direct agency+route_id visualised (200)")

    print("Set 6 checks passed ✅")


if __name__ == "__main__":
    test_set1_user_management_and_roles()
    test_set2_import_only()
    test_set3_data_access()
    test_set4_exploring_stops()
    test_set5_favourites()
    test_set6_visual_and_export()
