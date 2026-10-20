"""
Curated Pilot Dataset for Muğla Neighborhoods (Team Axiom - Agile Cross-Functional Module).
Covers 5 key neighborhoods in Muğla (Menteşe & Ula) to demonstrate the full MahallEN MVP pipeline.
"""

from sqlalchemy.orm import Session
from app.models.neighborhood import Neighborhood
from app.services.scoring_service import compute_overall_livability
from app.services.ai_service import STANDARD_DISCLAIMER

PILOT_NEIGHBORHOODS = [
    {
        "slug": "kotekli",
        "name": "Kötekli Mahallesi",
        "district": "Menteşe",
        "city": "Muğla",
        "tagline": "Vibrant university hub right next to MSKÜ campus with high student energy and 24/7 social life.",
        "latitude": 37.1692,
        "longitude": 28.3748,
        "safety_score": 72,
        "transport_score": 90,
        "cost_score": 62,
        "disaster_safety_score": 74,
        "suitability_student": 96,
        "suitability_family": 48,
        "suitability_professional": 64,
        "avg_rent_tl": 16500,
        "rent_range_tl": "13,000 TL - 21,000 TL (1+1 Studio)",
        "rent_trend_6m": "+18% (High academic season demand)",
        "bus_frequency_min": 5,
        "distance_to_campus_km": 0.6,
        "distance_to_center_km": 6.5,
        "pga_value_g": 0.38,
        "soil_class": "ZC (Medium-dense sand / stiff clay)",
        "earthquake_risk_level": "Moderate",
        "transport_highlights": [
            "Walking distance (5-10 min) to Muğla Sıtkı Koçman University main gates and library",
            "MUTTAŞ Yeniköy-Kötekli-Merkez buses depart every 5 minutes during peak hours",
            "Dedicated bike lanes and flat terrain ideal for e-scooters and walking",
        ],
        "news_items": [
            {
                "title": "Menteşe Municipality Expands Street Lighting and Camera Network in Kötekli",
                "source": "Muğla Gazetesi",
                "date": "2026-09-14",
                "sentiment": "positive",
                "summary": "New LED lighting and security cameras were installed along Sıtkı Koçman Caddesi to improve nighttime pedestrian safety for university students.",
            },
            {
                "title": "High Demand Pushes 1+1 Student Apartment Rents Up Ahead of Fall Semester",
                "source": "Ege Haber",
                "date": "2026-09-02",
                "sentiment": "negative",
                "summary": "Limited housing supply near campus caused studio flat prices to rise by nearly 18% compared to spring semester averages.",
            },
            {
                "title": "MUTTAŞ Adds Night Shuttle Services Connecting Kötekli and Menteşe Center",
                "source": "Muğla Büyükşehir Bülten",
                "date": "2026-08-21",
                "sentiment": "positive",
                "summary": "Public transit schedule extended until 01:30 AM to support student mobility and reduce taxi costs.",
            },
        ],
        "community_comments": [
            {
                "author_profile": "3rd Year Computer Eng. Student",
                "rating": 5,
                "comment": "Being able to wake up 20 minutes before a 9 AM lecture and walk to faculty is priceless. Cafes, copy centers, and markets are everywhere.",
                "platform": "Campus Forum Survey",
            },
            {
                "author_profile": "Graduate Student",
                "rating": 3,
                "comment": "Very lively and convenient, but street noise around main cafes continues until midnight and 1+1 rents are overpriced for the square footage.",
                "platform": "Ekşi / Local Review",
            },
            {
                "author_profile": "Family Resident",
                "rating": 2,
                "comment": "Parking is difficult and the neighborhood is almost entirely tailored to students rather than families with children.",
                "platform": "MahallEN Pilot Survey",
            },
        ],
        "data_sources": [
            "AFAD Türkiye Earthquake Hazard Map (PGA: 0.38g, Menteşe Basin)",
            "MUTTAŞ Public Transit Timetable & OpenStreetMap Stops (Line 1-48)",
            "Curated Regional Listing Index (Q3 2026 Menteşe 1+1 & 2+1 Averages)",
            "Local News Archive & MahallEN Student Housing Survey (n=28)",
        ],
        "ai_summary": (
            "Kötekli is the undisputed center of student life in Muğla, offering unmatched walkability "
            "to Muğla Sıtkı Koçman University and the Training & Research Hospital. While public transportation "
            "and social amenities score exceptionally high (90/100), intense seasonal student demand drives up "
            "per-square-meter rent prices and creates nighttime noise along main avenues. Most buildings are relatively "
            "newer low-rise (3-4 story) reinforced concrete structures on ZC soil class."
        ),
        "ai_pros": [
            "Walking distance (0.6 km) to MSKÜ campus and University Hospital",
            "High transit frequency (5-min intervals) and flat, bike-friendly streets",
            "Abundant student-budget cafes, supermarkets, pharmacies, and study spaces",
            "Relatively young building stock (mostly post-2007 low-rise apartments)",
        ],
        "ai_cons": [
            "High rent-to-size ratio for 1+1 furnished flats due to captive student demand",
            "Evening noise around cafe streets and dense street parking",
            "Limited quiet green parks or family-oriented school facilities",
        ],
    },
    {
        "slug": "emirbeyazit",
        "name": "Emirbeyazıt Mahallesi",
        "district": "Menteşe",
        "city": "Muğla",
        "tagline": "Central administrative, commercial, and residential heart of Menteşe with balanced urban living.",
        "latitude": 37.2154,
        "longitude": 28.3639,
        "safety_score": 88,
        "transport_score": 92,
        "cost_score": 58,
        "disaster_safety_score": 76,
        "suitability_student": 78,
        "suitability_family": 91,
        "suitability_professional": 95,
        "avg_rent_tl": 22000,
        "rent_range_tl": "18,000 TL - 28,000 TL (2+1 & 3+1 Family Flats)",
        "rent_trend_6m": "+12% (Steady urban demand)",
        "bus_frequency_min": 6,
        "distance_to_campus_km": 6.2,
        "distance_to_center_km": 0.4,
        "pga_value_g": 0.36,
        "soil_class": "ZC / ZB (Stiff clay & weathered rock transition)",
        "earthquake_risk_level": "Moderate",
        "transport_highlights": [
            "Central hub for all Menteşe urban bus lines and inter-district minibuses",
            "Walking access to Courthouse, Municipality, banks, and Recai Güreli Avenue",
            "15-minute direct bus ride to MSKÜ campus via Kötekli express lines",
        ],
        "news_items": [
            {
                "title": "Pedestrianization and Sidewalk Renewal Completed in Central Emirbeyazıt",
                "source": "Muğla Yenigün",
                "date": "2026-09-10",
                "sentiment": "positive",
                "summary": "Wider sidewalks and improved accessibility ramps were completed around the commercial center, boosting walkability for families and seniors.",
            },
            {
                "title": "Traffic Congestion Reported During Rush Hours Near School Zones",
                "source": "Muğla Haber",
                "date": "2026-08-29",
                "sentiment": "neutral",
                "summary": "Morning and evening peak hours see slow traffic around central intersections; municipality evaluating smart signal timing.",
            },
        ],
        "community_comments": [
            {
                "author_profile": "Civil Servant / Working Professional",
                "rating": 5,
                "comment": "Everything you need—banks, government offices, clinics, markets, and good restaurants—is within a 5-minute walk. Very safe at all hours.",
                "platform": "MahallEN Pilot Survey",
            },
            {
                "author_profile": "Parent of Two",
                "rating": 4,
                "comment": "Great primary and high schools nearby and peaceful residential side streets, though finding parking after 6 PM can be tough.",
                "platform": "Google Local Guide",
            },
        ],
        "data_sources": [
            "AFAD Türkiye Earthquake Hazard Map (PGA: 0.36g)",
            "MUTTAŞ Central Transit Hub Data & OpenStreetMap",
            "Menteşe Real Estate Market Index (Q3 2026)",
            "MahallEN Citizen & Student Survey (2026)",
        ],
        "ai_summary": (
            "Emirbeyazıt is the premier urban neighborhood of Menteşe, combining high safety (88/100) and "
            "top-tier transport connectivity (92/100). It serves as the primary choice for working professionals "
            "and families thanks to its immediate access to schools, government institutions, healthcare, and shopping. "
            "While monthly rents are higher than the district average due to larger 2+1 and 3+1 apartments, "
            "students sharing a flat also find it attractive for its central lifestyle."
        ),
        "ai_pros": [
            "Highest concentration of public services, banks, schools, and supermarkets",
            "Central transit node with direct buses to Kötekli, Akyaka, and surrounding districts",
            "Well-lit, safe streets with strong community presence and family atmosphere",
            "Balanced building stock with regulated urban zoning",
        ],
        "ai_cons": [
            "Higher average monthly rent (22,000 TL) primarily due to larger apartment sizes",
            "Rush-hour traffic congestion and limited street parking in commercial blocks",
            "20-minute bus commute required for daily university classes",
        ],
    },
    {
        "slug": "muslihittin",
        "name": "Muslihittin Mahallesi",
        "district": "Menteşe",
        "city": "Muğla",
        "tagline": "Quiet, tree-lined residential neighborhood offering a balanced bridge between city center and campus.",
        "latitude": 37.2088,
        "longitude": 28.3562,
        "safety_score": 86,
        "transport_score": 84,
        "cost_score": 70,
        "disaster_safety_score": 75,
        "suitability_student": 83,
        "suitability_family": 89,
        "suitability_professional": 88,
        "avg_rent_tl": 18500,
        "rent_range_tl": "15,000 TL - 23,000 TL (1+1 & 2+1 Flats)",
        "rent_trend_6m": "+14% (Balanced growth)",
        "bus_frequency_min": 8,
        "distance_to_campus_km": 5.8,
        "distance_to_center_km": 1.1,
        "pga_value_g": 0.37,
        "soil_class": "ZC (Medium-stiff alluvial & clay deposits)",
        "earthquake_risk_level": "Moderate",
        "transport_highlights": [
            "Easy access to main boulevard stops serving both Menteşe Center and Kötekli",
            "10-minute walk to central bazaar and municipal parks",
            "Flat walking and cycling routes with calmer residential traffic",
        ],
        "news_items": [
            {
                "title": "New Neighborhood Park and Sports Courts Opened in Muslihittin",
                "source": "Muğla Devrim",
                "date": "2026-09-05",
                "sentiment": "positive",
                "summary": "Menteşe Municipality inaugurated a green recreation area featuring walking tracks and children's playgrounds.",
            },
            {
                "title": "Natural Gas Network Maintenance Completed Ahead of Winter",
                "source": "Yerel Basın",
                "date": "2026-08-15",
                "sentiment": "positive",
                "summary": "Infrastructure upgrades ensure reliable heating across residential blocks for the upcoming winter season.",
            },
        ],
        "community_comments": [
            {
                "author_profile": "4th Year Medical Student",
                "rating": 5,
                "comment": "I moved here from Kötekli to study in peace. Much quieter at night, natural gas heating works great, and the bus to campus is right on the main road.",
                "platform": "MahallEN Pilot Survey",
            },
            {
                "author_profile": "Retiree & Long-time Resident",
                "rating": 4,
                "comment": "Neighborly culture is still alive here. Safe streets, green trees, and close to the Tuesday market.",
                "platform": "Local Community Forum",
            },
        ],
        "data_sources": [
            "AFAD Türkiye Earthquake Hazard Map (PGA: 0.37g)",
            "OpenStreetMap & MUTTAŞ Transit Network",
            "Menteşe Housing Dataset (Q3 2026)",
            "MahallEN Student & Resident Survey",
        ],
        "ai_summary": (
            "Muslihittin stands out as the most versatile all-rounder neighborhood in Menteşe (Overall Score: 79/100). "
            "It avoids the late-night noise of Kötekli and the commercial congestion of Emirbeyazıt while remaining "
            "within a 10-minute walk of the city center. With widespread natural gas heating, parks, and reasonable "
            "2+1 rents for roommates, it scores above 80 across students, families, and working professionals alike."
        ),
        "ai_pros": [
            "Strong balance of affordability, quiet streets, and central proximity",
            "High suitability for all three user profiles (Students 83, Families 89, Professionals 88)",
            "Widespread natural gas infrastructure and well-maintained neighborhood parks",
            "Ideal for 2-3 students sharing a larger 2+1 or 3+1 apartment",
        ],
        "ai_cons": [
            "Requires a 15-20 minute bus ride to reach MSKÜ university campus",
            "Some older building blocks from the late 1990s require individual inspection",
            "Limited late-night dining or entertainment venues after 10 PM",
        ],
    },
    {
        "slug": "orhaniye",
        "name": "Orhaniye Mahallesi",
        "district": "Menteşe",
        "city": "Muğla",
        "tagline": "Budget-friendly traditional and mixed-use neighborhood with affordable housing and local markets.",
        "latitude": 37.2015,
        "longitude": 28.3685,
        "safety_score": 76,
        "transport_score": 80,
        "cost_score": 82,
        "disaster_safety_score": 70,
        "suitability_student": 81,
        "suitability_family": 75,
        "suitability_professional": 74,
        "avg_rent_tl": 14500,
        "rent_range_tl": "11,500 TL - 18,000 TL (1+1 & 2+1 Flats)",
        "rent_trend_6m": "+10% (Most affordable central option)",
        "bus_frequency_min": 10,
        "distance_to_campus_km": 4.9,
        "distance_to_center_km": 1.3,
        "pga_value_g": 0.39,
        "soil_class": "ZC / ZD (Alluvial basin margin)",
        "earthquake_risk_level": "Moderate",
        "transport_highlights": [
            "Located along the southern corridor connecting Menteşe Center toward Kötekli/Yatağan highway",
            "10-minute bus intervals and easy access to intercity bus terminal (Otogar)",
            "Short walk to local neighborhood markets and artisan workshops",
        ],
        "news_items": [
            {
                "title": "Urban Renewal and Road Asphalt Work Conducted in Orhaniye Streets",
                "source": "Muğla Gazetesi",
                "date": "2026-09-01",
                "sentiment": "positive",
                "summary": "Municipality teams renewed worn asphalt and stormwater drainage lines in lower Orhaniye.",
            },
            {
                "title": "Students Look to Orhaniye as an Affordable Alternative to Kötekli",
                "source": "Ege Haber",
                "date": "2026-09-12",
                "sentiment": "positive",
                "summary": "Lower rent averages attract budget-conscious students willing to take a 12-minute bus ride to campus.",
            },
        ],
        "community_comments": [
            {
                "author_profile": "2nd Year Economics Student",
                "rating": 4,
                "comment": "We rented a spacious 2+1 here for less than a tiny 1+1 in Kötekli. Closer to the bus terminal and markets are cheaper.",
                "platform": "MahallEN Pilot Survey",
            },
            {
                "author_profile": "Local Tradesperson",
                "rating": 4,
                "comment": "Authentic neighborhood with friendly grocers, though some older streets are narrow and mix residential buildings with small workshops.",
                "platform": "Local Review",
            },
        ],
        "data_sources": [
            "AFAD Türkiye Earthquake Hazard Map (PGA: 0.39g)",
            "OpenStreetMap & MUTTAŞ Route Data",
            "Menteşe Affordable Housing Survey (Q3 2026)",
        ],
        "ai_summary": (
            "Orhaniye offers the highest cost affordability score (82/100) among Menteşe's central neighborhoods. "
            "Positioned between the city center and the university route, it provides a practical alternative for "
            "students and working residents seeking lower rents (averaging 14,500 TL). While newer apartment blocks "
            "exist along main avenues, prospective tenants should verify building age and heating type in older backstreets."
        ),
        "ai_pros": [
            "Most budget-friendly rent levels (14,500 TL average) close to both center and campus route",
            "Proximity to Menteşe Intercity Bus Terminal (Otogar) and affordable local markets",
            "Shorter commute to MSKÜ campus (4.9 km) compared to northern central neighborhoods",
            "Strong cost-to-space value for shared flats",
        ],
        "ai_cons": [
            "Mixed building age; older pre-2000 buildings require careful seismic and insulation checks",
            "Narrower side streets and fewer modern cafe/social lounges",
            "Some blocks near commercial/industrial edges have higher daytime noise",
        ],
    },
    {
        "slug": "akyaka",
        "name": "Akyaka Mahallesi",
        "district": "Ula",
        "city": "Muğla",
        "tagline": "Cittaslow coastal town famous for Nail Çakırhan architecture, Azmak River, and high quality of life.",
        "latitude": 37.0556,
        "longitude": 28.3242,
        "safety_score": 92,
        "transport_score": 68,
        "cost_score": 45,
        "disaster_safety_score": 66,
        "suitability_student": 65,
        "suitability_family": 84,
        "suitability_professional": 90,
        "avg_rent_tl": 27500,
        "rent_range_tl": "22,000 TL - 38,000 TL (1+1 & 2+1 Coastal Houses)",
        "rent_trend_6m": "+24% (Strong tourism & remote-worker demand)",
        "bus_frequency_min": 20,
        "distance_to_campus_km": 22.5,
        "distance_to_center_km": 26.0,
        "pga_value_g": 0.44,
        "soil_class": "ZD / ZC (Coastal alluvial & Gökova fault zone proximity)",
        "earthquake_risk_level": "Moderate-High",
        "transport_highlights": [
            "Direct MUTTAŞ minibus service to Kötekli and Menteşe every 20-30 minutes via Sakar Pass",
            "Highly walkable and bikeable local town layout with coastal promenade",
            "25-minute scenic drive (22.5 km) to MSKÜ campus",
        ],
        "news_items": [
            {
                "title": "Akyaka Sees Year-Round Population Rise Driven by Remote Workers",
                "source": "Muğla Postası",
                "date": "2026-09-18",
                "sentiment": "positive",
                "summary": "Digital nomads and professionals increasingly choose Akyaka for full-year residence, boosting off-season cafe and fiber internet infrastructure.",
            },
            {
                "title": "Long-Term Annual Rental Supply Remains Tight Due to Short-Term Tourism Demand",
                "source": "Gökova Haber",
                "date": "2026-08-27",
                "sentiment": "negative",
                "summary": "Students and year-round tenants face high rent prices and seasonal contract pressures from landlords.",
            },
        ],
        "community_comments": [
            {
                "author_profile": "Remote Software Engineer",
                "rating": 5,
                "comment": "Living by the sea and pine forests in a strict 2-story architectural zone is unmatched. Peaceful in winter, vibrant in summer.",
                "platform": "MahallEN Pilot Survey",
            },
            {
                "author_profile": "Fine Arts Student",
                "rating": 4,
                "comment": "Magical place to live, and strict 2-story wood/stone houses feel safer, but commuting up Sakar Pass every morning takes 30 minutes and rent is expensive.",
                "platform": "Campus Forum Survey",
            },
        ],
        "data_sources": [
            "AFAD Gökova Graben Hazard Data (PGA: 0.44g, strictly 2-story Cittaslow zoning)",
            "MUTTAŞ Menteşe-Akyaka Line Timetable",
            "Ula / Akyaka Coastal Rental Index (Q3 2026)",
        ],
        "ai_summary": (
            "Akyaka offers a resort-level coastal lifestyle with exceptional safety (92/100) and strict two-story "
            "traditional architectural zoning. While it sits near the active Gökova fault line (PGA 0.44g), the mandatory "
            "low-rise (max 2-floor) building code significantly mitigates structural collapse risk. However, high annual "
            "rents (27,500 TL average) and a 22.5 km commute up the Sakar Pass make it a premium choice best suited for "
            "remote professionals, families, or students with private transport."
        ),
        "ai_pros": [
            "Exceptional coastal nature, sea breeze, and Cittaslow peaceful environment",
            "Strict low-rise (maximum 2-story) architectural regulation across the entire town",
            "Very high personal safety score (92/100) and strong community culture",
            "Popular hub for remote professionals, creatives, and watersports enthusiasts",
        ],
        "ai_cons": [
            "Highest rent cost in the pilot region (27,500 TL avg) and scarce 12-month contracts",
            "22.5 km commute via winding Sakar Pass to reach MSKÜ campus or Menteşe hospitals",
            "Located in the active Gökova seismic zone with coastal alluvial soil pockets",
        ],
    },
]


def seed_initial_data(db: Session) -> None:
    """Seeds the database with Muğla pilot neighborhoods if empty."""
    existing_count = db.query(Neighborhood).count()
    if existing_count > 0:
        return

    for item in PILOT_NEIGHBORHOODS:
        overall = compute_overall_livability(
            safety=item["safety_score"],
            transportation=item["transport_score"],
            cost_affordability=item["cost_score"],
            disaster_resilience=item["disaster_safety_score"],
        )
        neighborhood = Neighborhood(
            slug=item["slug"],
            name=item["name"],
            district=item["district"],
            city=item["city"],
            tagline=item["tagline"],
            latitude=item["latitude"],
            longitude=item["longitude"],
            overall_score=overall,
            safety_score=item["safety_score"],
            transport_score=item["transport_score"],
            cost_score=item["cost_score"],
            disaster_safety_score=item["disaster_safety_score"],
            suitability_student=item["suitability_student"],
            suitability_family=item["suitability_family"],
            suitability_professional=item["suitability_professional"],
            avg_rent_tl=item["avg_rent_tl"],
            rent_range_tl=item["rent_range_tl"],
            rent_trend_6m=item["rent_trend_6m"],
            bus_frequency_min=item["bus_frequency_min"],
            distance_to_campus_km=item["distance_to_campus_km"],
            distance_to_center_km=item["distance_to_center_km"],
            pga_value_g=item["pga_value_g"],
            soil_class=item["soil_class"],
            earthquake_risk_level=item["earthquake_risk_level"],
            transport_highlights=item["transport_highlights"],
            news_items=item["news_items"],
            community_comments=item["community_comments"],
            data_sources=item["data_sources"],
            ai_summary=item["ai_summary"],
            ai_pros=item["ai_pros"],
            ai_cons=item["ai_cons"],
            ai_disclaimer=STANDARD_DISCLAIMER,
        )
        db.add(neighborhood)

    db.commit()
