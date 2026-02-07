# COMP9321 - Data Services Engineering

UNSW Master of IT coursework.

## Assignments

### airbnb-data-analysis (Assignment 1)

Data wrangling and exploratory analysis of Sydney Airbnb listings and reviews using Pandas, GeoPandas, and Matplotlib.

**Data files** (not included, download from [Inside Airbnb](http://insideairbnb.com/)):
- `listings.csv`
- `reviews.csv`
- `neighbourhoods.geojson`

**Setup:**
```bash
cd airbnb-data-analysis
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter notebook analysis.ipynb
```

### restful-api (Assignment 2)

RESTful API built with Flask-RESTX for importing and querying Sydney bus network data (GTFS). Features JWT authentication, role-based access control (Admin/Planner/Commuter), favourites, and route visualisation.

**Setup:**
```bash
cd restful-api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**API key:** Register at [Transport for NSW Open Data](https://opendata.transport.nsw.gov.au/) and create `transport_api_key.env`:
```
TRANSPORT_API_KEY=your_key_here
```

**Run:**
```bash
python api.py        # API at http://localhost:5000, Swagger UI at /docs
python tests.py      # Automated test suite
```
