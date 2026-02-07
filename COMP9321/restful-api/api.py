import os, io, zipfile, csv, secrets
from datetime import datetime
from typing import Optional
from functools import wraps

from flask import Flask, request, g
from flask_restx import Api, Namespace, Resource, fields
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from dotenv import load_dotenv

from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Float, UniqueConstraint, func, or_
from sqlalchemy.orm import sessionmaker, scoped_session, declarative_base
from sqlalchemy.exc import IntegrityError
import requests

from flask import send_file, make_response
import matplotlib
matplotlib.use("Agg")
import itertools
import matplotlib.pyplot as plt
from pyproj import Transformer
from flask import send_file

# -----------------------------------------------------------------------------
# App & Config
# -----------------------------------------------------------------------------
app = Flask(__name__)
app.config["RESTX_MASK_SWAGGER"] = False

# -----------------------------------------------------------------------------
# Swagger UI Helper Message
# -----------------------------------------------------------------------------
CORS(app)
from pathlib import Path
_base = Path(__file__).resolve().parent
load_dotenv(_base / "transport_api_key.env")  
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev_change_me")
app.config["JWT_HEADER_TYPE"] = None
jwt = JWTManager(app)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///app.sqlite")
engine = create_engine(DATABASE_URL, future=True)
SessionLocal = scoped_session(sessionmaker(bind=engine, autoflush=False, autocommit=False))
Base = declarative_base()

@app.before_request
def _bind_session():
    g.db = SessionLocal()

@app.teardown_request
def _cleanup_session(exc):
    db = getattr(g, "db", None)
    if db is not None:
        if exc:
            db.rollback()
        else:
            db.commit()
        db.close()
        SessionLocal.remove()

authorizations = {
    'Bearer': {'type': 'apiKey', 'in': 'header', 'name': 'Authorization'}
}
api = Api(
    app,
    version="1.0",
    title="COMP9321 A2 GTFS API",
    description=(
        "REST API for importing NSW GTFS data and exploring routes/stops/trips.\n\n"
        "**Auth:** Paste your JWT token via the green `Authorize` button "
        "(you can paste the token directly; `Bearer` prefix is optional here).\n\n"
        "**Roles:** Admin | Planner | Commuter (see each endpoint's notes)."
    ),
    doc="/docs",
    authorizations=authorizations,
    security="Bearer",
)

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    token = Column(String(64), unique=True)  # kept for backward-compat; unused with JWT
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def set_password(self, raw: str):
        self.password_hash = generate_password_hash(raw, method="pbkdf2:sha256", salt_length=16)

    def check_password(self, raw: str) -> bool:
        return check_password_hash(self.password_hash, raw)

class Agency(Base):
    __tablename__ = 'gtfs_agencies'
    id = Column(Integer, primary_key=True)
    mode = Column(String(20), nullable=False)
    agency_id = Column(String(40), nullable=False)
    imported_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    __table_args__ = (UniqueConstraint('mode', 'agency_id', name='uq_mode_agency'),)

class Route(Base):
    __tablename__ = 'gtfs_routes'
    id = Column(Integer, primary_key=True)
    agency_key = Column(String(80), index=True)
    route_id = Column(String(64), index=True)
    route_short_name = Column(String(64))
    route_long_name = Column(String(255))
    route_type = Column(Integer)

class Stop(Base):
    __tablename__ = 'gtfs_stops'
    id = Column(Integer, primary_key=True)
    agency_key = Column(String(80), index=True)
    stop_id = Column(String(64), index=True)
    stop_name = Column(String(255))
    stop_lat = Column(Float)
    stop_lon = Column(Float)

class Trip(Base):
    __tablename__ = 'gtfs_trips'
    id = Column(Integer, primary_key=True)
    agency_key = Column(String(80), index=True)
    trip_id = Column(String(64), index=True)
    route_id = Column(String(64), index=True)
    service_id = Column(String(64))
    trip_headsign = Column(String(255))
    direction_id = Column(Integer)

class StopTime(Base):
    __tablename__ = 'gtfs_stop_times'
    id = Column(Integer, primary_key=True)
    agency_key = Column(String(80), index=True)
    trip_id = Column(String(64), index=True)
    arrival_time = Column(String(16))
    departure_time = Column(String(16))
    stop_id = Column(String(64), index=True)
    stop_sequence = Column(Integer)

class Favourite(Base):
    __tablename__ = "favourites"
    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, nullable=False, index=True)
    agency_key = Column(String(80), nullable=False)   # e.g. "buses:GSBC001"
    route_id   = Column(String(64),  nullable=False)
    alias      = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "agency_key", "route_id", name="uq_user_agency_route"),
    )


Base.metadata.create_all(engine)

# --- Seed default users (admin/planner/commuter) for first run ---
def _ensure_user(db, username: str, password: str, role: str):
    u = db.query(User).filter(User.username == username).first()
    if not u:
        u = User(username=username, role=role, active=True)
        u.set_password(password)
        db.add(u)
        db.commit()

with SessionLocal() as _db:
    _ensure_user(_db, 'admin',    'admin',    'admin')
    _ensure_user(_db, 'planner',  'planner',  'planner')
    _ensure_user(_db, 'commuter', 'commuter', 'commuter')


# -----------------------------------------------------------------------------
# Auth Helpers (JWT)
# -----------------------------------------------------------------------------

def _user_from_identity(identity: str) -> Optional[User]:
    if not identity:
        return None
    return g.db.query(User).filter(User.username == identity).first()


def require_auth(role: Optional[str] = None, roles: Optional[tuple] = None):
    """Decorator: require logged-in user; enforce a single role or any of roles."""
    allowed = roles if roles else ((role,) if role else tuple())
    def deco(fn):
        @jwt_required()
        @wraps(fn)
        def wrapper(*args, **kwargs):
            username = get_jwt_identity()
            user = _user_from_identity(username)
            if user is None:
                return {"error": "Unauthorized"}, 401
            if not user.active:
                return {"error": "Account deactivated"}, 403
            if allowed and user.role not in allowed:
                return {"error": "Forbidden"}, 403
            request.user = user
            return fn(*args, **kwargs)
        return wrapper
    return deco

# -----------------------------------------------------------------------------
# API Schemas
# -----------------------------------------------------------------------------
user_model = api.model('User', {
    'id': fields.Integer(readOnly=True),
    'username': fields.String(required=True),
    'role': fields.String(enum=['admin', 'planner', 'commuter'], required=True),
    'active': fields.Boolean(required=True),
    'created_at': fields.DateTime,
})

login_model = api.model('Login', {
    'username': fields.String(required=True),
    'password': fields.String(required=True),
})

error_model = api.model("Error", {
    "error": fields.String(example="Agency not imported")
})

user_create_model = api.model('UserCreate', {
    'username': fields.String(required=True, description='New username'),
    'password': fields.String(required=True, description='Plain password'),
    'role': fields.String(enum=['planner','commuter'], required=True,
                          description='Role of the new user')
})

admin_user_patch_model = api.model('UserPatch', {
    'active': fields.Boolean(required=True, description='Activate or deactivate user')
})

pagination_model = api.model("Pagination", {
    "agency": fields.String(example="buses:GSBC001"),
    "total": fields.Integer(example=633),
    "page": fields.Integer(example=1),
    "page_size": fields.Integer(example=50),
})

token_model = api.model('Token', {'token': fields.String})

route_item = api.model("RouteItem", {
    "route_id": fields.String(example="4000"),
    "route_short_name": fields.String(example="4000"),
    "route_long_name": fields.String(example="Penrith to Mt Druitt"),
    "route_type": fields.Integer(example=3),
})
routes_response = api.inherit("RoutesResponse", pagination_model, {
    "items": fields.List(fields.Nested(route_item))
})

stop_item = api.model("StopItem", {
    "stop_id": fields.String(example="123456"),
    "stop_name": fields.String(example="Penrith Station, Stand A"),
    "stop_lat": fields.Float(example=-33.7503),
    "stop_lon": fields.Float(example=150.6923),
})
stops_response = api.inherit("StopsResponse", pagination_model, {
    "items": fields.List(fields.Nested(stop_item))
})

trip_item = api.model("TripItem", {
    "trip_id": fields.String(example="2501_4000_1"),
    "route_id": fields.String(example="4000"),
    "service_id": fields.String(example="WEEKDAY"),
    "trip_headsign": fields.String(example="To Mt Druitt"),
    "direction_id": fields.Integer(example=0),
})
trips_response = api.inherit("TripsResponse", pagination_model, {
    "items": fields.List(fields.Nested(trip_item))
})

favorite_create_model = api.model('FavoriteCreate', {
    'agency': fields.String(required=True, description="Agency id (e.g., 'GSBC001')"),
    'route_id': fields.String(required=True, description="Route id within the agency (e.g., '4000')"),
    'alias': fields.String(description="Optional user alias for the favorite route")
})

favorite_update_model = api.model('FavoriteUpdate', {
    'alias': fields.String(required=True, description="New alias (display name) for the favorite")
})

favorite_item_model = api.model('FavoriteItem', {
    'id':        fields.Integer(description='Favorite id'),
    'user_id':  fields.Integer(description='User id'),
    'agency':    fields.String(description='Agency key, e.g. buses:GSBC001'),
    'route_id':  fields.String(description='Route id'),
    'alias':     fields.String(description='Alias for display'),  
    'created_at': fields.DateTime(description='Creation time (UTC)'),
})

favorite_list_model = api.model('FavoriteList', {
    'items': fields.List(fields.Nested(favorite_item_model)),
    'total': fields.Integer(description='Total favorites for current user')
})

viz_query_model = api.parser() \
    .add_argument('format', location='query', required=False, choices=('png','csv'),
                  help="Output format: png (default) returns an image; csv returns route points") \
    .add_argument('width', location='query', type=int, required=False, help="PNG width in pixels (default 1000)") \
    .add_argument('height', location='query', type=int, required=False, help="PNG height in pixels (default 600)") \
    .add_argument('dpi', location='query', type=int, required=False, help="PNG DPI (default 120)")


# -----------------------------------------------------------------------------
# Namespaces & Endpoints
# -----------------------------------------------------------------------------
auth_ns = Namespace('auth', description='Authentication')
admin_ns = Namespace('admin', description='Admin – user management')
api.add_namespace(auth_ns, path='/auth')
api.add_namespace(admin_ns, path='/admin')

@auth_ns.route('/login')
class Login(Resource):
    @auth_ns.expect(login_model, validate=True)
    @auth_ns.response(200, 'OK', token_model)
    @auth_ns.response(401, "Invalid credentials", error_model)
    @auth_ns.doc(
        summary="Login to obtain JWT",
        description=(
            "Returns a JWT token for subsequent calls. "
            "Use the green **Authorize** button to paste the token.\n\n"
            "**Roles:** any of `admin|planner|commuter` with the given credentials."
        ),
        security=[]
    )
    def post(self):
        payload = request.json or {}
        user = g.db.query(User).filter(User.username == payload.get('username')).first()
        if not user or not user.check_password(payload.get('password', '')):
            return {"error": "Invalid credentials"}, 401
        # create JWT (identity = username)
        token = create_access_token(identity=user.username)
        return {"token": token}

@admin_ns.route('/users')
class Users(Resource):
    @require_auth(role='admin')
    @admin_ns.doc(
        summary="List users",
        description="**Role:** Admin only.",
        responses={200: "OK", 401: "Unauthorized", 403: "Forbidden"}
    )
    def get(self):
        users = g.db.query(User).order_by(User.id.asc()).all()
        return [{
            'id': u.id,
            'username': u.username,
            'role': u.role,
            'active': u.active,
            'created_at': (u.created_at.isoformat() if u.created_at else None)
        } for u in users]

    @require_auth(role='admin')
    @admin_ns.expect(user_create_model, validate=False)
    @admin_ns.response(201, "Created", user_model)
    @admin_ns.response(400, "Bad request", error_model)
    @admin_ns.doc(
        summary="Create planner/commuter",
        description="**Role:** Admin only. Payload must contain username/password/role.",
    )
    def post(self):
        payload = request.json or {}
        username = (payload.get('username') or '').strip()
        password = payload.get('password') or ''
        role = payload.get('role') or ''
        if not username or not password or role not in ('planner','commuter'):
            return {"error":"username, password, role(planner|commuter) required"}, 400
        if g.db.query(User).filter(User.username == username).first():
            return {"error":"username already exists"}, 400
        u = User(username=username, role=role, active=True)
        u.set_password(password)
        g.db.add(u)
        g.db.commit()
        return {"id": u.id, "username": u.username, "role": u.role, "active": u.active, "created_at": (u.created_at.isoformat() if u.created_at else None)}, 201

@admin_ns.route('/users/<int:user_id>')
class UserItem(Resource):
    @require_auth(role='admin')
    def get(self, user_id: int):
        u = g.db.query(User).get(user_id)
        if not u:
            return {"error":"not found"}, 404
        return {"id": u.id, "username": u.username, "role": u.role, "active": u.active, "created_at": (u.created_at.isoformat() if u.created_at else None)}

    @require_auth(role='admin')
    @admin_ns.expect(admin_user_patch_model, validate=True)
    @admin_ns.doc(consumes=['application/json'])
    def patch(self, user_id: int):
        u = g.db.query(User).get(user_id)
        if not u:
            return {"error":"not found"}, 404
        payload = request.json or {}
        if 'active' not in payload:
            return {"error":"active(boolean) required"}, 400
        u.active = bool(payload['active'])
        g.db.commit()
        return {
            "id": u.id, "username": u.username, "role": u.role,
            "active": u.active, "created_at": (u.created_at.isoformat() if u.created_at else None)
        }
    
    @require_auth(role='admin')
    def delete(self, user_id: int):
        u = g.db.query(User).get(user_id)
        if not u:
            return {"error":"not found"}, 404
        if u.username == 'admin':
            return {"error":"cannot delete the Admin account"}, 400
        g.db.delete(u)
        g.db.commit()
        return {"status":"deleted"}

# -----------------------------------------------------------------------------
# GTFS Constants & Import
# -----------------------------------------------------------------------------
GTFS_BASE_URL = "https://api.transport.nsw.gov.au/v1/gtfs/schedule"
GTFS_VALID = {
    'buses': ['GSBC001','GSBC002','GSBC003','GSBC004','SBSC006','GSBC007','GSBC008','GSBC009','GSBC010','GSBC014']
}

def _tfnsw_api_key():
    """Read TfNSW API key from env; this course mandates the name TRANSPORT_API_KEY."""
    key = os.getenv('TRANSPORT_API_KEY')
    return key

def _fetch_gtfs_zip(mode: str, agency_id: str) -> bytes:
    url = f"{GTFS_BASE_URL}/{mode}/{agency_id}"
    headers = {"Authorization": f"apikey {_tfnsw_api_key()}"}
    r = requests.get(url, headers=headers, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"TfNSW fetch failed: {r.status_code}")
    return r.content

def _clear_agency_data(agency_key: str):
    for model in (Route, Stop, Trip, StopTime):
        g.db.query(model).filter(model.agency_key == agency_key).delete(synchronize_session=False)
    g.db.commit()

def _parse_and_store(agency_key: str, zip_bytes: bytes):
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        names = {n.lower(): n for n in z.namelist()}  # case-insensitive map
        def find_path(target_basename: str):
            # handle zips that have a folder prefix like 'google_transit/routes.txt'
            tl = target_basename.lower()
            for n in z.namelist():
                if n.lower().endswith('/' + tl) or n.lower() == tl:
                    return n
            return None
        def read_csv(target_basename):
            p = find_path(target_basename)
            if not p:
                return []
            with z.open(p) as f:
                return list(csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig')))

        routes = read_csv('routes.txt')
        stops = read_csv('stops.txt')
        trips = read_csv('trips.txt')
        stop_times = read_csv('stop_times.txt')

        for r in routes:
            g.db.add(Route(agency_key=agency_key, route_id=r.get('route_id'),
                           route_short_name=r.get('route_short_name'), route_long_name=r.get('route_long_name'),
                           route_type=int(r.get('route_type') or 0)))
        for s in stops:
            g.db.add(Stop(agency_key=agency_key, stop_id=s.get('stop_id'), stop_name=s.get('stop_name'),
                          stop_lat=float(s.get('stop_lat') or 0.0), stop_lon=float(s.get('stop_lon') or 0.0)))
        for t in trips:
            g.db.add(Trip(agency_key=agency_key, trip_id=t.get('trip_id'), route_id=t.get('route_id'),
                          service_id=t.get('service_id'), trip_headsign=t.get('trip_headsign'),
                          direction_id=int(t.get('direction_id') or 0)))
        for st in stop_times:
            g.db.add(StopTime(agency_key=agency_key, trip_id=st.get('trip_id'), arrival_time=st.get('arrival_time'),
                              departure_time=st.get('departure_time'), stop_id=st.get('stop_id'),
                              stop_sequence=int(st.get('stop_sequence') or 0)))
        g.db.commit()


gtfs_ns = Namespace('gtfs', description='GTFS import')

from flask_restx.reqparse import RequestParser

routes_parser = RequestParser(bundle_errors=True)
routes_parser.add_argument("agency", type=str, required=True, help="Agency id (e.g. GSBC001).")
routes_parser.add_argument("q", type=str, help="Fuzzy search string.")
routes_parser.add_argument("route_type", type=int, help="Filter by GTFS route_type (int).")
routes_parser.add_argument("page", type=int, default=1)
routes_parser.add_argument("page_size", type=int, default=50)

stops_parser = RequestParser(bundle_errors=True)
stops_parser.add_argument("agency", type=str, required=True)
stops_parser.add_argument("q", type=str, help="Stop name/id contains this text.")
stops_parser.add_argument("page", type=int, default=1)
stops_parser.add_argument("page_size", type=int, default=50)

trips_parser = RequestParser(bundle_errors=True)
trips_parser.add_argument("agency", type=str, required=True)
trips_parser.add_argument("route_id", type=str, help="Filter trips by route_id.")
trips_parser.add_argument("q", type=str, help="Trip id/headsign contains this text.")
trips_parser.add_argument("direction_id", type=int, help="0 or 1")
trips_parser.add_argument("page", type=int, default=1)
trips_parser.add_argument("page_size", type=int, default=50)


api.add_namespace(gtfs_ns, path='/gtfs')

# -----------------------------
# Query helpers (Set 3/4)
# -----------------------------

def _agency_key_from_query():
    agency = (request.args.get('agency') or '').strip()
    if not agency:
        return None, (400, {"error": "query parameter 'agency' is required"})
    if agency not in GTFS_VALID.get('buses', []):
        return None, (404, {"error": "Unknown agency"})
    return f"buses:{agency}", None


def _ensure_imported(agency_key: str):
    # consider imported if there is at least one route for this agency
    return g.db.query(Route).filter(Route.agency_key == agency_key).count() > 0


def _get_pagination():
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 50))
    except ValueError:
        return 1, 50
    page = max(page, 1)
    page_size = max(1, min(page_size, 200))
    return page, page_size

@gtfs_ns.route('/import/<string:mode>/<string:agency_id>')
class Import(Resource):
    @require_auth(roles=('admin','planner'))
    @gtfs_ns.response(200, "Imported")
    @gtfs_ns.response(400, "Only GSBC*/SBSC* allowed", error_model)
    @gtfs_ns.response(404, "Unknown agency", error_model)
    @gtfs_ns.doc(
        summary="Import GTFS zip for a bus agency",
        description=(
            "Downloads GTFS zip from TfNSW and stores into local SQLite.\n\n"
            "**Role:** Admin & Planner.\n"
            "**Allowed:** `mode=buses` and `agency_id` prefix `GSBC` or `SBSC` (Sydney Metro buses)."
        ),
        params={"mode": "buses", "agency_id": "GSBC001 / SBSC006"},
    )
    def post(self, mode, agency_id):
        # Set 2: only buses with GSBC* or SBSC*
        if mode != 'buses' or not (agency_id.startswith('GSBC') or agency_id.startswith('SBSC')):
            return {"error": "Only Sydney Metro bus agencies (GSBC*/SBSC*) are allowed"}, 400
        if agency_id not in GTFS_VALID.get('buses', []):
            return {"error": "Unknown agency"}, 404
        agency_key = f"{mode}:{agency_id}"
        # Replace old data if exists
        _clear_agency_data(agency_key)
        data = _fetch_gtfs_zip(mode, agency_id)
        _parse_and_store(agency_key, data)
        # (Optional) record import time
        rec = g.db.query(Agency).filter(Agency.mode==mode, Agency.agency_id==agency_id).first()
        if not rec:
            rec = Agency(mode=mode, agency_id=agency_id)
            g.db.add(rec)
        rec.imported_at = datetime.utcnow()
        g.db.commit()
        return {"status": "ok", "agency": agency_key}

# -----------------------------
# Set 3/4: Read-only query endpoints
# -----------------------------

@gtfs_ns.route('/routes')
class Routes(Resource):
    @require_auth(roles=('admin','planner','commuter'))
    @gtfs_ns.expect(routes_parser)
    @gtfs_ns.marshal_with(routes_response, code=200, description="OK")
    @gtfs_ns.response(400, "Invalid query", error_model)
    @gtfs_ns.response(404, "Agency not imported / unknown agency", error_model)
    @gtfs_ns.doc(
        summary="List routes for an agency",
        description=(
            "Lists routes with pagination and optional fuzzy search.\n\n"
            "**Role:** All users.\n"
            "Query: `agency` (required), `q`, `route_type`, `page`, `page_size`."
        )
    )
    def get(self):
        agency_key, err = _agency_key_from_query()
        if err:
            code, body = err
            return body, code
        if not _ensure_imported(agency_key):
            return {"error": "Agency not imported"}, 404
        q = g.db.query(Route).filter(Route.agency_key == agency_key)
        qstr = (request.args.get('q') or '').strip()
        if qstr:
            ilike = f"%{qstr}%"
            q = q.filter(or_(Route.route_id.ilike(ilike), Route.route_short_name.ilike(ilike), Route.route_long_name.ilike(ilike)))
        rtype = request.args.get('route_type')
        if rtype is not None and rtype != '':
            try:
                q = q.filter(Route.route_type == int(rtype))
            except ValueError:
                return {"error": "route_type must be int"}, 400
        page, page_size = _get_pagination()
        total = q.count()
        items = q.order_by(Route.route_id).offset((page-1)*page_size).limit(page_size).all()
        return {
            "agency": agency_key,
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [{
                "route_id": r.route_id,
                "route_short_name": r.route_short_name,
                "route_long_name": r.route_long_name,
                "route_type": r.route_type,
            } for r in items]
        }

@gtfs_ns.route('/stops')
class Stops(Resource):
    @require_auth(roles=('admin','planner','commuter'))
    @require_auth(roles=('admin','planner','commuter'))
    @gtfs_ns.expect(stops_parser)
    @gtfs_ns.marshal_with(stops_response, code=200, description="OK")
    @gtfs_ns.response(404, "Agency not imported / unknown agency", error_model)
    @gtfs_ns.doc(
        summary="List stops for an agency",
        description="**Role:** All users. Supports case-insensitive & partial matches via `q`.",
    )
    def get(self):
        agency_key, err = _agency_key_from_query()
        if err:
            code, body = err
            return body, code
        if not _ensure_imported(agency_key):
            return {"error": "Agency not imported"}, 404
        q = g.db.query(Stop).filter(Stop.agency_key == agency_key)
        qstr = (request.args.get('q') or '').strip()
        if qstr:
            ilike = f"%{qstr}%"
            q = q.filter(or_(Stop.stop_id.ilike(ilike), Stop.stop_name.ilike(ilike)))
        page, page_size = _get_pagination()
        total = q.count()
        items = q.order_by(Stop.stop_id).offset((page-1)*page_size).limit(page_size).all()
        return {
            "agency": agency_key,
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [{
                "stop_id": s.stop_id,
                "stop_name": s.stop_name,
                "stop_lat": s.stop_lat,
                "stop_lon": s.stop_lon,
            } for s in items]
        }

@gtfs_ns.route('/trips')
class Trips(Resource):
    @require_auth(roles=('admin','planner','commuter'))
    @gtfs_ns.expect(trips_parser)
    @gtfs_ns.marshal_with(trips_response, code=200, description="OK")
    @gtfs_ns.response(404, "Agency not imported / unknown agency", error_model)
    @gtfs_ns.doc(
        summary="List trips for an agency (optionally filter by route)",
        description=(
            "**Role:** All users. Query: `agency` (required), `route_id`, `q`, `direction_id`, `page`, `page_size`."
        ),
    )
    def get(self):
        agency_key, err = _agency_key_from_query()
        if err:
            code, body = err
            return body, code
        if not _ensure_imported(agency_key):
            return {"error": "Agency not imported"}, 404
        q = g.db.query(Trip).filter(Trip.agency_key == agency_key)
        route_id = (request.args.get('route_id') or '').strip()
        if route_id:
            q = q.filter(Trip.route_id == route_id)
        qstr = (request.args.get('q') or '').strip()
        if qstr:
            ilike = f"%{qstr}%"
            q = q.filter(or_(Trip.trip_id.ilike(ilike), Trip.trip_headsign.ilike(ilike)))
        direction = request.args.get('direction_id')
        if direction is not None and direction != '':
            try:
                q = q.filter(Trip.direction_id == int(direction))
            except ValueError:
                return {"error": "direction_id must be int"}, 400
        page, page_size = _get_pagination()
        total = q.count()
        items = q.order_by(Trip.trip_id).offset((page-1)*page_size).limit(page_size).all()
        return {
            "agency": agency_key,
            "total": total,
            "page": page,
            "page_size": page_size,
            "items": [{
                "trip_id": t.trip_id,
                "route_id": t.route_id,
                "service_id": t.service_id,
                "trip_headsign": t.trip_headsign,
                "direction_id": t.direction_id,
            } for t in items]
        }


# -----------------------------
# Set 5: Favourites (all roles manage their own)
# -----------------------------
fav_ns = Namespace('favorites', description='Favourite routes')
api.add_namespace(fav_ns, path='/favorites')

def _current_user():
    return getattr(request, "user", None)

def _fav_to_public(f: Favourite):
    agency = f.agency_key.split(":", 1)[1] if ":" in f.agency_key else f.agency_key
    return {"id": f.id, "agency": agency, "route_id": f.route_id, "alias": f.alias}

@fav_ns.route("")
class FavouritesList(Resource):
    @require_auth(roles=('admin','planner','commuter'))
    @fav_ns.doc(
        summary="List my favorites",
        description="Return current user's favorite routes.")
    @fav_ns.marshal_with(favorite_list_model, code=200, description='OK')
    def get(self):
        user = request.user
        rows = (
            g.db.query(Favourite)
                .filter(Favourite.user_id == user.id)    
                .order_by(Favourite.id.desc())
                .all()
        )
        items = [{
            "id": r.id,
            "user_id": r.user_id,              
            "agency": r.agency_key,
            "route_id": r.route_id,
            "alias": r.alias,                        
            "created_at": r.created_at.isoformat() if getattr(r, "created_at", None) else None,
        } for r in rows]
        return {"items": items, "total": len(items)}, 200

    @require_auth(roles=('admin','planner','commuter'))
    @fav_ns.doc(
        summary="Create a favorite route",
        description="Add a route to current user's favorites. A user can have **at most two** favorites.")
    @fav_ns.expect(favorite_create_model, validate=True)
    @fav_ns.marshal_with(favorite_item_model, code=201, description='Created')
    @fav_ns.response(400, 'Bad Request (missing/invalid fields)')
    @fav_ns.response(409, 'Conflict (already has two favorites/already favourited)')
    def post(self):
        user = request.user
        data = request.get_json(silent=True) or {}

        agency  = (data.get("agency")   or "").strip().upper()
        route_id = (data.get("route_id") or "").strip()
        alias    = (data.get("alias")    or "").strip() or None

        if not agency or not route_id:
            return {"msg": "agency and route_id required"}, 400

        agency_key = f"buses:{agency}"

        exists = (
            g.db.query(Favourite)
            .filter(
                Favourite.user_id  == user.id,
                Favourite.agency_key == agency_key,
                Favourite.route_id == route_id
            )
            .first()
        )
        if exists:
            return {"msg": "already favourited"}, 409

        cnt = (
            g.db.query(Favourite)
            .filter(Favourite.user_id == user.id)
            .count()
        )
        if cnt >= 2:
            return {"msg": "favourite limit reached"}, 409

        fav = Favourite(
            user_id=user.id,
            agency_key=agency_key,
            route_id=route_id,
            alias=alias,
        )
        try:
            g.db.add(fav)
            g.db.commit()
        except IntegrityError:
            g.db.rollback()
            return {"msg": "already favourited"}, 409

        return {
            "id": fav.id,
            "user_id": fav.user_id,
            "agency": fav.agency_key,
            "route_id": fav.route_id,
            "alias": fav.alias,
            "created_at": fav.created_at.isoformat() if getattr(fav, "created_at", None) else None,
        }, 201

@fav_ns.route("/<int:fav_id>")
@fav_ns.param('fav_id', 'Favorite id')
class FavouriteItem(Resource):
    @require_auth(roles=('admin','planner','commuter'))
    @fav_ns.doc(
        summary="Update a favorite",
        description="Update fields of a favorite (currently only `alias`).")
    @fav_ns.expect(favorite_update_model, validate=True)
    @fav_ns.response(200, 'OK', favorite_item_model)
    @fav_ns.response(404, 'Favorite not found (or not owned by current user)')
    def patch(self, fav_id: int):
        u = _current_user()
        f = g.db.query(Favourite).get(fav_id)
        if not f or f.user_id != u.id:
            return {"msg": "not found"}, 404
        data = request.get_json(silent=True) or {}
        if "alias" in data:
            f.alias = data["alias"]
            g.db.commit()
        return _fav_to_public(f), 200

    @require_auth(roles=('admin','planner','commuter'))
    @fav_ns.doc(
        summary="Delete a favorite",
        description="Remove a favorite route of the current user.")
    @fav_ns.response(204, 'Deleted')
    @fav_ns.response(404, 'Favorite not found (or not owned by current user)')
    def delete(self, fav_id: int):
        u = _current_user()
        f = g.db.query(Favourite).get(fav_id)
        if not f or f.user_id != u.id:
            return {"msg": "not found"}, 404
        g.db.delete(f); g.db.commit()
        return {"msg": "deleted"}, 200


# -----------------------------
# Set 6: Visualisation & Export
# -----------------------------
viz_ns = Namespace('viz', description='Visualisation & Export')
api.add_namespace(viz_ns, path='/viz')

def _pick_one_trip_for_route(agency_key: str, route_id: str) -> Optional[str]:
    """Pick a representative trip of a route."""
    t = (g.db.query(Trip)
         .filter(Trip.agency_key == agency_key, Trip.route_id == route_id)
         .order_by(Trip.trip_id.asc()).first())
    return t.trip_id if t else None

def _coords_for_trip(agency_key: str, trip_id: str):
    """Return ordered (lon, lat, stop_name, stop_id, seq) for a trip."""
    sts = (g.db.query(StopTime.stop_id, StopTime.stop_sequence)
           .filter(StopTime.agency_key == agency_key,
                   StopTime.trip_id == trip_id)
           .order_by(StopTime.stop_sequence.asc())
           .all())
    if not sts:
        return []

    stop_ids = [sid for sid, _ in sts]
    stops_map = {s.stop_id: s for s in g.db.query(Stop)
                 .filter(Stop.agency_key == agency_key,
                         Stop.stop_id.in_(stop_ids)).all()}
    coords = []
    for sid, seq in sts:
        s = stops_map.get(sid)
        if s and s.stop_lat is not None and s.stop_lon is not None:
            coords.append((s.stop_lon, s.stop_lat, s.stop_name, s.stop_id, seq))
    return coords

@viz_ns.route("/map")
class FavouriteMap(Resource):
    @require_auth(roles=('admin','planner','commuter'))
    @viz_ns.doc(
        summary="Generate a map for my favorite routes",
        description=(
            "Render the **shape(s)** of current user's favorite routes on a web map "
            "with a basemap (contextily). Returns **PNG bytes** by default.\n\n"
            "**Query options**:\n"
            "- `format=png|csv` : `png` returns an image; `csv` returns sampled lat/lon points per route.\n"
            "- `width`/`height` : PNG size in pixels (defaults 1000×600).\n"
            "- `dpi` : image DPI (default 120).\n"
        )
    )
    @viz_ns.expect(viz_query_model)
    @viz_ns.produces(['image/png', 'text/csv'])
    @viz_ns.response(200, 'OK (PNG or CSV)')
    @viz_ns.response(204, 'No content (user has no favorites)')
    def get(self):
        u = _current_user()
        fmt = (request.args.get("format") or "png").lower()

        pairs = []
        agency = (request.args.get("agency") or "").strip()
        route_id = (request.args.get("route_id") or "").strip()
        if agency and route_id:  
            if agency not in GTFS_VALID.get('buses', []):
                return {"error": "Unknown agency"}, 404
            pairs = [(f"buses:{agency}", route_id)]
        else:
            favs = g.db.query(Favourite).filter(Favourite.user_id == u.id).all()
            if not favs:
                return {"error": "no favourites found; add some via /favorites"}, 400
            pairs = [(f.agency_key, f.route_id) for f in favs]

        series = []
        titles = []
        for ak, rid in pairs:
            if not _ensure_imported(ak):
                continue
            trip_id = _pick_one_trip_for_route(ak, rid)
            if not trip_id:
                continue
            coords = _coords_for_trip(ak, trip_id)
            if coords:
                rinfo = g.db.query(Route).filter(Route.agency_key == ak, Route.route_id == rid).first()
                title = (rinfo.route_short_name or rid) if rinfo else rid
                series.append((ak, rid, coords, title))
                titles.append(title)

        if not series:
            return {"error": "no shape data available for selected routes"}, 404

        # CSV 
        if fmt == "csv":
            out = io.StringIO()
            writer = csv.writer(out)
            writer.writerow(["agency","route_id","seq","stop_id","stop_name","lon","lat"])
            for ak, rid, coords, _ in series:
                for lon, lat, name, sid, seq in coords:
                    writer.writerow([ak.split(":",1)[1], rid, seq, sid, name or "", f"{lon:.6f}", f"{lat:.6f}"])
            resp = make_response(out.getvalue())
            resp.headers["Content-Type"] = "text/csv; charset=utf-8"
            resp.headers["Content-Disposition"] = "inline; filename=favourites.csv"
            return resp

        # PNG drawing
                # PNG drawing —— white background, fast; draw polyline + start/end only
        

        # size from query (defaults match your docstring)
        width  = int(request.args.get("width")  or 1000)
        height = int(request.args.get("height") or 600)
        dpi    = int(request.args.get("dpi")    or 120)
        lw     = float(request.args.get("lw")   or 2.0)

        # inches for matplotlib
        figsize = (width / dpi, height / dpi)

        fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
        fig.patch.set_facecolor("white")
        ax.set_facecolor("white")

        # colors & projector (WGS84 -> WebMercator meters for nice scaling)
        colors = itertools.cycle(plt.cm.tab10.colors)
        to3857 = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

        all_x, all_y = [], []

        for ak, rid, coords, title in series:
            if not coords:
                continue
            col = next(colors)

            # extract & project
            lons = [lon for lon, lat, *_ in coords]
            lats = [lat for lon, lat, *_ in coords]
            xs, ys = to3857.transform(lons, lats)

            ax.plot(xs, ys, "-", color=col, linewidth=lw, label=title, zorder=2)

            sx, sy = xs[0], ys[0]
            ex, ey = xs[-1], ys[-1]
            sname  = coords[0][2] or coords[0][3] or "Start"
            ename  = coords[-1][2] or coords[-1][3] or "End"
            ax.scatter([sx, ex], [sy, ey], s=max(18, lw*8), color=col, zorder=3)
            ax.annotate(sname, (sx, sy), xytext=(4, 4),
                        textcoords="offset points", fontsize=8, alpha=0.9, zorder=4)
            ax.annotate(ename, (ex, ey), xytext=(4, 4),
                        textcoords="offset points", fontsize=8, alpha=0.9, zorder=4)

            all_x.extend(xs); all_y.extend(ys)

        # viewbox with padding
        if all_x and all_y:
            minx, maxx = min(all_x), max(all_x)
            miny, maxy = min(all_y), max(all_y)
            pad_x = max((maxx - minx) * 0.10, 200)   # at least 200m padding
            pad_y = max((maxy - miny) * 0.10, 200)
            ax.set_xlim(minx - pad_x, maxx + pad_x)
            ax.set_ylim(miny - pad_y, maxy + pad_y)

        # aesthetics
        ax.set_aspect("auto")         
        ax.set_axis_off()
        ax.set_title("Favourite Route Shape(s) on Map")
        if len(series) > 1:
            ax.legend(loc="best", fontsize=8)

        # return PNG bytes (inline)
        buf = io.BytesIO()
        plt.tight_layout(pad=0)
        fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
        fig.savefig(buf, format="png")
        plt.close(fig)
        buf.seek(0)
        return send_file(buf, mimetype="image/png", as_attachment=False)


api.add_namespace(fav_ns, path="/favorites")




if __name__ == '__main__':
    app.run(debug=True, port=5000)
