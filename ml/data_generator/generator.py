"""
Data Generator — Smart Waste Management Platform (Hyderabad, India)
Generates 365 days of realistic synthetic fill-level history for 100 smart bins
distributed across Hyderabad's wards and landmarks.

Bin count: 100
City: Hyderabad, Telangana, India
Data points: 100 bins × 365 days × 24 hrs = 876,000 records
Trucks: 5 municipal collection trucks

Hardware Note:
    These bins mirror the data schema that an actual ESP32+Ultrasonic Sensor
    would transmit. Each record = one hourly IoT reading.

Run:
    python -m ml.data_generator.generator
"""
import os
import sys
import datetime
import random
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

# Allow imports from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database.db import engine, init_db, SessionLocal
from database.models import Bin, FillHistory, Truck, Driver

# ──────────────────────────────────────────────────────────────
#  100 HYDERABAD BINS — Real GPS Coordinates
#  Spread across wards, landmarks, and neighbourhoods
# ──────────────────────────────────────────────────────────────

HYDERABAD_BINS = [
    # ── Banjara Hills (Ward 10) ──
    {"bin_id":"BIN001","lat":17.4156,"lon":78.4486,"street":"Road No.12, Banjara Hills","area":"Banjara Hills","ward":"Ward-10","ward_num":10,"area_type":"Residential","cap":240},
    {"bin_id":"BIN002","lat":17.4138,"lon":78.4493,"street":"Road No.2, Banjara Hills","area":"Banjara Hills","ward":"Ward-10","ward_num":10,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN003","lat":17.4179,"lon":78.4451,"street":"Peddamma Temple Road","area":"Banjara Hills","ward":"Ward-10","ward_num":10,"area_type":"Park","cap":180},
    {"bin_id":"BIN004","lat":17.4125,"lon":78.4512,"street":"Care Hospital Junction","area":"Banjara Hills","ward":"Ward-10","ward_num":10,"area_type":"Hospital","cap":480},
    {"bin_id":"BIN005","lat":17.4201,"lon":78.4468,"street":"GVK One Mall Entrance","area":"Banjara Hills","ward":"Ward-10","ward_num":10,"area_type":"Mall","cap":500},
    # ── Jubilee Hills (Ward 9) ──
    {"bin_id":"BIN006","lat":17.4329,"lon":78.4073,"street":"Road No.36, Jubilee Hills","area":"Jubilee Hills","ward":"Ward-9","ward_num":9,"area_type":"Residential","cap":240},
    {"bin_id":"BIN007","lat":17.4312,"lon":78.4089,"street":"Jubilee Hills Check Post","area":"Jubilee Hills","ward":"Ward-9","ward_num":9,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN008","lat":17.4350,"lon":78.4058,"street":"People's Plaza Road","area":"Jubilee Hills","ward":"Ward-9","ward_num":9,"area_type":"Market","cap":420},
    {"bin_id":"BIN009","lat":17.4374,"lon":78.4021,"street":"Film Nagar Road","area":"Jubilee Hills","ward":"Ward-9","ward_num":9,"area_type":"Residential","cap":240},
    {"bin_id":"BIN010","lat":17.4298,"lon":78.4102,"street":"KBR National Park Gate","area":"Jubilee Hills","ward":"Ward-9","ward_num":9,"area_type":"Park","cap":180},
    # ── Hitech City / Madhapur (Ward 13) ──
    {"bin_id":"BIN011","lat":17.4484,"lon":78.3904,"street":"Hitech City Main Road","area":"Madhapur","ward":"Ward-13","ward_num":13,"area_type":"Commercial","cap":480},
    {"bin_id":"BIN012","lat":17.4501,"lon":78.3873,"street":"Cyber Towers Junction","area":"Madhapur","ward":"Ward-13","ward_num":13,"area_type":"Commercial","cap":480},
    {"bin_id":"BIN013","lat":17.4460,"lon":78.3946,"street":"Inorbit Mall Road","area":"Madhapur","ward":"Ward-13","ward_num":13,"area_type":"Mall","cap":500},
    {"bin_id":"BIN014","lat":17.4522,"lon":78.3851,"street":"DLF Cybercity Gate 1","area":"Madhapur","ward":"Ward-13","ward_num":13,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN015","lat":17.4475,"lon":78.3917,"street":"Madhapur Circle","area":"Madhapur","ward":"Ward-13","ward_num":13,"area_type":"Restaurant","cap":300},
    # ── Kondapur (Ward 14) ──
    {"bin_id":"BIN016","lat":17.4643,"lon":78.3606,"street":"Kondapur Main Road","area":"Kondapur","ward":"Ward-14","ward_num":14,"area_type":"Residential","cap":240},
    {"bin_id":"BIN017","lat":17.4622,"lon":78.3625,"street":"Ashoka Metro Pillar","area":"Kondapur","ward":"Ward-14","ward_num":14,"area_type":"Residential","cap":240},
    {"bin_id":"BIN018","lat":17.4660,"lon":78.3591,"street":"Kondapur KPHB Road","area":"Kondapur","ward":"Ward-14","ward_num":14,"area_type":"Market","cap":420},
    {"bin_id":"BIN019","lat":17.4605,"lon":78.3643,"street":"Oasis Centre Road","area":"Kondapur","ward":"Ward-14","ward_num":14,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN020","lat":17.4680,"lon":78.3570,"street":"Kondapur Bus Depot","area":"Kondapur","ward":"Ward-14","ward_num":14,"area_type":"Bus Stand","cap":420},
    # ── Gachibowli (Ward 15) ──
    {"bin_id":"BIN021","lat":17.4401,"lon":78.3489,"street":"Gachibowli Stadium Road","area":"Gachibowli","ward":"Ward-15","ward_num":15,"area_type":"Park","cap":300},
    {"bin_id":"BIN022","lat":17.4380,"lon":78.3511,"street":"Financial District Road","area":"Gachibowli","ward":"Ward-15","ward_num":15,"area_type":"Commercial","cap":480},
    {"bin_id":"BIN023","lat":17.4425,"lon":78.3467,"street":"ISB Campus Gate","area":"Gachibowli","ward":"Ward-15","ward_num":15,"area_type":"School","cap":360},
    {"bin_id":"BIN024","lat":17.4365,"lon":78.3530,"street":"Mind Space Junction","area":"Gachibowli","ward":"Ward-15","ward_num":15,"area_type":"Commercial","cap":480},
    {"bin_id":"BIN025","lat":17.4444,"lon":78.3445,"street":"University of Hyderabad Gate","area":"Gachibowli","ward":"Ward-15","ward_num":15,"area_type":"School","cap":300},
    # ── Begumpet / Secunderabad (Ward 5) ──
    {"bin_id":"BIN026","lat":17.4441,"lon":78.4614,"street":"Begumpet Airport Road","area":"Begumpet","ward":"Ward-5","ward_num":5,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN027","lat":17.4463,"lon":78.4593,"street":"Sarojini Devi Hospital","area":"Begumpet","ward":"Ward-5","ward_num":5,"area_type":"Hospital","cap":480},
    {"bin_id":"BIN028","lat":17.4420,"lon":78.4635,"street":"Paradise Circle","area":"Begumpet","ward":"Ward-5","ward_num":5,"area_type":"Restaurant","cap":300},
    {"bin_id":"BIN029","lat":17.4487,"lon":78.4572,"street":"Secunderabad Clock Tower","area":"Secunderabad","ward":"Ward-5","ward_num":5,"area_type":"Market","cap":420},
    {"bin_id":"BIN030","lat":17.4502,"lon":78.4556,"street":"Secunderabad Railway Station","area":"Secunderabad","ward":"Ward-5","ward_num":5,"area_type":"Railway Station","cap":500},
    # ── Old City / Charminar (Ward 1) ──
    {"bin_id":"BIN031","lat":17.3616,"lon":78.4747,"street":"Charminar Road","area":"Charminar","ward":"Ward-1","ward_num":1,"area_type":"Market","cap":500},
    {"bin_id":"BIN032","lat":17.3598,"lon":78.4763,"street":"Laad Bazaar","area":"Charminar","ward":"Ward-1","ward_num":1,"area_type":"Market","cap":480},
    {"bin_id":"BIN033","lat":17.3641,"lon":78.4731,"street":"Mecca Masjid Road","area":"Charminar","ward":"Ward-1","ward_num":1,"area_type":"Market","cap":420},
    {"bin_id":"BIN034","lat":17.3575,"lon":78.4782,"street":"Shalibanda Road","area":"Charminar","ward":"Ward-1","ward_num":1,"area_type":"Residential","cap":240},
    {"bin_id":"BIN035","lat":17.3660,"lon":78.4714,"street":"Purani Haveli Road","area":"Charminar","ward":"Ward-1","ward_num":1,"area_type":"Market","cap":420},
    # ── Ameerpet (Ward 7) ──
    {"bin_id":"BIN036","lat":17.4374,"lon":78.4494,"street":"Ameerpet Metro Station","area":"Ameerpet","ward":"Ward-7","ward_num":7,"area_type":"Commercial","cap":480},
    {"bin_id":"BIN037","lat":17.4355,"lon":78.4512,"street":"SR Nagar Road","area":"Ameerpet","ward":"Ward-7","ward_num":7,"area_type":"Residential","cap":240},
    {"bin_id":"BIN038","lat":17.4392,"lon":78.4476,"street":"Ameerpet Bus Stand","area":"Ameerpet","ward":"Ward-7","ward_num":7,"area_type":"Bus Stand","cap":420},
    {"bin_id":"BIN039","lat":17.4415,"lon":78.4455,"street":"ESI Hospital Gate","area":"Ameerpet","ward":"Ward-7","ward_num":7,"area_type":"Hospital","cap":480},
    {"bin_id":"BIN040","lat":17.4338,"lon":78.4531,"street":"Panjagutta Junction","area":"Ameerpet","ward":"Ward-7","ward_num":7,"area_type":"Commercial","cap":360},
    # ── Kukatpally (Ward 16) ──
    {"bin_id":"BIN041","lat":17.4948,"lon":78.3996,"street":"KPHB Colony Phase 1","area":"Kukatpally","ward":"Ward-16","ward_num":16,"area_type":"Residential","cap":240},
    {"bin_id":"BIN042","lat":17.4972,"lon":78.3975,"street":"Kukatpally Metro Station","area":"Kukatpally","ward":"Ward-16","ward_num":16,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN043","lat":17.4925,"lon":78.4018,"street":"BDL Junction","area":"Kukatpally","ward":"Ward-16","ward_num":16,"area_type":"Industrial","cap":300},
    {"bin_id":"BIN044","lat":17.4991,"lon":78.3954,"street":"JNTU Hyderabad Gate","area":"Kukatpally","ward":"Ward-16","ward_num":16,"area_type":"School","cap":360},
    {"bin_id":"BIN045","lat":17.4904,"lon":78.4040,"street":"Moosapet Main Road","area":"Kukatpally","ward":"Ward-16","ward_num":16,"area_type":"Market","cap":420},
    # ── LB Nagar / Dilsukhnagar (Ward 2) ──
    {"bin_id":"BIN046","lat":17.3490,"lon":78.5546,"street":"LB Nagar Circle","area":"LB Nagar","ward":"Ward-2","ward_num":2,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN047","lat":17.3512,"lon":78.5525,"street":"LB Nagar Metro Station","area":"LB Nagar","ward":"Ward-2","ward_num":2,"area_type":"Bus Stand","cap":420},
    {"bin_id":"BIN048","lat":17.3682,"lon":78.5318,"street":"Dilsukhnagar Main Road","area":"Dilsukhnagar","ward":"Ward-2","ward_num":2,"area_type":"Market","cap":480},
    {"bin_id":"BIN049","lat":17.3660,"lon":78.5340,"street":"Dilsukhnagar Bus Stand","area":"Dilsukhnagar","ward":"Ward-2","ward_num":2,"area_type":"Bus Stand","cap":420},
    {"bin_id":"BIN050","lat":17.3700,"lon":78.5295,"street":"Moula Ali Industrial Area","area":"Dilsukhnagar","ward":"Ward-2","ward_num":2,"area_type":"Industrial","cap":300},
    # ── Uppal (Ward 3) ──
    {"bin_id":"BIN051","lat":17.4062,"lon":78.5596,"street":"Uppal Ring Road","area":"Uppal","ward":"Ward-3","ward_num":3,"area_type":"Industrial","cap":300},
    {"bin_id":"BIN052","lat":17.4040,"lon":78.5618,"street":"Uppal Bus Stand","area":"Uppal","ward":"Ward-3","ward_num":3,"area_type":"Bus Stand","cap":420},
    {"bin_id":"BIN053","lat":17.4083,"lon":78.5574,"street":"NGRI Colony Road","area":"Uppal","ward":"Ward-3","ward_num":3,"area_type":"Residential","cap":240},
    {"bin_id":"BIN054","lat":17.4105,"lon":78.5551,"street":"Ramanthapur Market","area":"Uppal","ward":"Ward-3","ward_num":3,"area_type":"Market","cap":420},
    {"bin_id":"BIN055","lat":17.4020,"lon":78.5643,"street":"Mallapur Industrial","area":"Uppal","ward":"Ward-3","ward_num":3,"area_type":"Industrial","cap":300},
    # ── Mehdipatnam (Ward 8) ──
    {"bin_id":"BIN056","lat":17.3948,"lon":78.4376,"street":"Mehdipatnam Circle","area":"Mehdipatnam","ward":"Ward-8","ward_num":8,"area_type":"Commercial","cap":480},
    {"bin_id":"BIN057","lat":17.3926,"lon":78.4398,"street":"Rethibowli Market","area":"Mehdipatnam","ward":"Ward-8","ward_num":8,"area_type":"Market","cap":420},
    {"bin_id":"BIN058","lat":17.3970,"lon":78.4354,"street":"Shamsabad Road Junction","area":"Mehdipatnam","ward":"Ward-8","ward_num":8,"area_type":"Residential","cap":240},
    {"bin_id":"BIN059","lat":17.3905,"lon":78.4421,"street":"Tolichowki Main Road","area":"Mehdipatnam","ward":"Ward-8","ward_num":8,"area_type":"Restaurant","cap":300},
    {"bin_id":"BIN060","lat":17.3989,"lon":78.4331,"street":"Santosh Nagar Colony","area":"Mehdipatnam","ward":"Ward-8","ward_num":8,"area_type":"Residential","cap":240},
    # ── Koti / Abids (Ward 4) ──
    {"bin_id":"BIN061","lat":17.3830,"lon":78.4787,"street":"Koti Sultan Bazaar","area":"Koti","ward":"Ward-4","ward_num":4,"area_type":"Market","cap":500},
    {"bin_id":"BIN062","lat":17.3851,"lon":78.4765,"street":"Abids Circle","area":"Abids","ward":"Ward-4","ward_num":4,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN063","lat":17.3809,"lon":78.4810,"street":"Nampally Station Road","area":"Nampally","ward":"Ward-4","ward_num":4,"area_type":"Railway Station","cap":500},
    {"bin_id":"BIN064","lat":17.3874,"lon":78.4740,"street":"Public Gardens Entrance","area":"Abids","ward":"Ward-4","ward_num":4,"area_type":"Park","cap":180},
    {"bin_id":"BIN065","lat":17.3788,"lon":78.4834,"street":"Gandhi Bhavan Road","area":"Nampally","ward":"Ward-4","ward_num":4,"area_type":"Commercial","cap":360},
    # ── Miyapur (Ward 17) ──
    {"bin_id":"BIN066","lat":17.4973,"lon":78.3464,"street":"Miyapur Metro Station","area":"Miyapur","ward":"Ward-17","ward_num":17,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN067","lat":17.4951,"lon":78.3486,"street":"Miyapur Main Road","area":"Miyapur","ward":"Ward-17","ward_num":17,"area_type":"Residential","cap":240},
    {"bin_id":"BIN068","lat":17.4998,"lon":78.3441,"street":"Kollur Road Junction","area":"Miyapur","ward":"Ward-17","ward_num":17,"area_type":"Residential","cap":240},
    {"bin_id":"BIN069","lat":17.5020,"lon":78.3418,"street":"Chandanagar Market","area":"Miyapur","ward":"Ward-17","ward_num":17,"area_type":"Market","cap":420},
    {"bin_id":"BIN070","lat":17.4930,"lon":78.3510,"street":"BHEL Township","area":"Miyapur","ward":"Ward-17","ward_num":17,"area_type":"Residential","cap":240},
    # ── Saidabad / Malakpet (Ward 6) ──
    {"bin_id":"BIN071","lat":17.3520,"lon":78.5052,"street":"Malakpet Bus Depot","area":"Malakpet","ward":"Ward-6","ward_num":6,"area_type":"Bus Stand","cap":420},
    {"bin_id":"BIN072","lat":17.3543,"lon":78.5031,"street":"Chaderghat Bridge","area":"Malakpet","ward":"Ward-6","ward_num":6,"area_type":"Residential","cap":240},
    {"bin_id":"BIN073","lat":17.3496,"lon":78.5073,"street":"Saidabad Colony","area":"Saidabad","ward":"Ward-6","ward_num":6,"area_type":"Residential","cap":240},
    {"bin_id":"BIN074","lat":17.3470,"lon":78.5096,"street":"Karan Shah Market","area":"Saidabad","ward":"Ward-6","ward_num":6,"area_type":"Market","cap":420},
    {"bin_id":"BIN075","lat":17.3566,"lon":78.5010,"street":"Champapet Road","area":"Saidabad","ward":"Ward-6","ward_num":6,"area_type":"Residential","cap":240},
    # ── Kompally (Ward 18) ──
    {"bin_id":"BIN076","lat":17.5403,"lon":78.4723,"street":"Kompally Main Road","area":"Kompally","ward":"Ward-18","ward_num":18,"area_type":"Residential","cap":240},
    {"bin_id":"BIN077","lat":17.5427,"lon":78.4699,"street":"Kompally Market Area","area":"Kompally","ward":"Ward-18","ward_num":18,"area_type":"Market","cap":420},
    {"bin_id":"BIN078","lat":17.5380,"lon":78.4748,"street":"Bowrampet Road","area":"Kompally","ward":"Ward-18","ward_num":18,"area_type":"Residential","cap":240},
    {"bin_id":"BIN079","lat":17.5450,"lon":78.4674,"street":"Alwal Bus Stand","area":"Kompally","ward":"Ward-18","ward_num":18,"area_type":"Bus Stand","cap":360},
    {"bin_id":"BIN080","lat":17.5358,"lon":78.4770,"street":"Suraram Industrial Area","area":"Kompally","ward":"Ward-18","ward_num":18,"area_type":"Industrial","cap":300},
    # ── Nacharam / Habsiguda (Ward 3B) ──
    {"bin_id":"BIN081","lat":17.4214,"lon":78.5284,"street":"Nacharam Industrial","area":"Nacharam","ward":"Ward-3B","ward_num":19,"area_type":"Industrial","cap":300},
    {"bin_id":"BIN082","lat":17.4236,"lon":78.5261,"street":"Habsiguda Main Road","area":"Habsiguda","ward":"Ward-3B","ward_num":19,"area_type":"Residential","cap":240},
    {"bin_id":"BIN083","lat":17.4192,"lon":78.5308,"street":"Tarnaka Junction","area":"Tarnaka","ward":"Ward-3B","ward_num":19,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN084","lat":17.4260,"lon":78.5237,"street":"Stadium Road","area":"Habsiguda","ward":"Ward-3B","ward_num":19,"area_type":"Park","cap":180},
    {"bin_id":"BIN085","lat":17.4170,"lon":78.5332,"street":"Malkajgiri Circle","area":"Malkajgiri","ward":"Ward-3B","ward_num":19,"area_type":"Commercial","cap":360},
    # ── Shamshabad / Airport Zone (Ward 20) ──
    {"bin_id":"BIN086","lat":17.2403,"lon":78.4294,"street":"Rajiv Gandhi Int. Airport","area":"Shamshabad","ward":"Ward-20","ward_num":20,"area_type":"Commercial","cap":500},
    {"bin_id":"BIN087","lat":17.2427,"lon":78.4271,"street":"Airport Road Toll Plaza","area":"Shamshabad","ward":"Ward-20","ward_num":20,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN088","lat":17.2378,"lon":78.4318,"street":"Shamshabad Market","area":"Shamshabad","ward":"Ward-20","ward_num":20,"area_type":"Market","cap":420},
    {"bin_id":"BIN089","lat":17.2450,"lon":78.4248,"street":"Outer Ring Road Junction","area":"Shamshabad","ward":"Ward-20","ward_num":20,"area_type":"Residential","cap":240},
    {"bin_id":"BIN090","lat":17.2355,"lon":78.4342,"street":"Shamshabad Bus Stand","area":"Shamshabad","ward":"Ward-20","ward_num":20,"area_type":"Bus Stand","cap":360},
    # ── Khairatabad (Ward 11) ──
    {"bin_id":"BIN091","lat":17.4210,"lon":78.4578,"street":"Khairatabad Metro","area":"Khairatabad","ward":"Ward-11","ward_num":11,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN092","lat":17.4232,"lon":78.4556,"street":"Khairatabad Market","area":"Khairatabad","ward":"Ward-11","ward_num":11,"area_type":"Market","cap":480},
    {"bin_id":"BIN093","lat":17.4189,"lon":78.4600,"street":"Hussain Sagar Lake Path","area":"Khairatabad","ward":"Ward-11","ward_num":11,"area_type":"Park","cap":180},
    {"bin_id":"BIN094","lat":17.4255,"lon":78.4533,"street":"Indira Park Road","area":"Khairatabad","ward":"Ward-11","ward_num":11,"area_type":"Park","cap":180},
    {"bin_id":"BIN095","lat":17.4170,"lon":78.4623,"street":"Punjagutta Circle","area":"Punjagutta","ward":"Ward-11","ward_num":11,"area_type":"Commercial","cap":480},
    # ── Yapral / Maredpally (Ward 5B) ──
    {"bin_id":"BIN096","lat":17.4820,"lon":78.5195,"street":"Yapral Main Road","area":"Yapral","ward":"Ward-5B","ward_num":21,"area_type":"Residential","cap":240},
    {"bin_id":"BIN097","lat":17.4842,"lon":78.5173,"street":"Maredpally Market","area":"Maredpally","ward":"Ward-5B","ward_num":21,"area_type":"Market","cap":420},
    {"bin_id":"BIN098","lat":17.4798,"lon":78.5218,"street":"Karkhana Road","area":"Karkhana","ward":"Ward-5B","ward_num":21,"area_type":"Residential","cap":240},
    {"bin_id":"BIN099","lat":17.4864,"lon":78.5150,"street":"Lothukunta Circle","area":"Yapral","ward":"Ward-5B","ward_num":21,"area_type":"Commercial","cap":360},
    {"bin_id":"BIN100","lat":17.4776,"lon":78.5241,"street":"Dammaiguda Road","area":"Yapral","ward":"Ward-5B","ward_num":21,"area_type":"Residential","cap":240},
]

# ─────────────────────────────────────────────────────────────
#  TRUCK FLEET (Municipal Corporation of Hyderabad)
# ─────────────────────────────────────────────────────────────

TRUCK_FLEET = [
    {"truck_id": "TRK-HYD-01", "plate": "TS09EA0001", "capacity": 5000, "driver": "Ramesh Kumar", "driver_id": "DRV001"},
    {"truck_id": "TRK-HYD-02", "plate": "TS09EA0002", "capacity": 5000, "driver": "Suresh Reddy",  "driver_id": "DRV002"},
    {"truck_id": "TRK-HYD-03", "plate": "TS09EA0003", "capacity": 5000, "driver": "Vijay Babu",    "driver_id": "DRV003"},
    {"truck_id": "TRK-HYD-04", "plate": "TS09EA0004", "capacity": 5000, "driver": "Naresh Yadav",  "driver_id": "DRV004"},
    {"truck_id": "TRK-HYD-05", "plate": "TS09EA0005", "capacity": 4000, "driver": "Prasad Goud",   "driver_id": "DRV005"},
]

DRIVER_DETAILS = [
    {"driver_id":"DRV001","name":"Ramesh Kumar","phone":"9876543210","license":"TS123456"},
    {"driver_id":"DRV002","name":"Suresh Reddy","phone":"9876543211","license":"TS123457"},
    {"driver_id":"DRV003","name":"Vijay Babu",  "phone":"9876543212","license":"TS123458"},
    {"driver_id":"DRV004","name":"Naresh Yadav","phone":"9876543213","license":"TS123459"},
    {"driver_id":"DRV005","name":"Prasad Goud", "phone":"9876543214","license":"TS123460"},
]

# ─────────────────────────────────────────────────────────────
#  AREA PARAMETERS
# ─────────────────────────────────────────────────────────────

AREA_PARAMS = {
    "Residential":      {"base_fill_rate": 1.8,  "peak_hours": [7, 8, 12, 18, 19, 20], "pop_density": 4500, "holiday_boost": 1.2},
    "Commercial":       {"base_fill_rate": 2.5,  "peak_hours": [9, 10, 11, 12, 13, 14, 15, 16], "pop_density": 8000, "holiday_boost": 0.4},
    "Market":           {"base_fill_rate": 3.8,  "peak_hours": [8, 9, 10, 11, 12, 16, 17, 18, 19], "pop_density": 12000, "holiday_boost": 1.6},
    "Hospital":         {"base_fill_rate": 2.2,  "peak_hours": [8, 9, 10, 11, 14, 15, 16], "pop_density": 5000, "holiday_boost": 0.8},
    "School":           {"base_fill_rate": 2.0,  "peak_hours": [7, 8, 12, 13, 16, 17], "pop_density": 3500, "holiday_boost": 0.1},
    "Restaurant":       {"base_fill_rate": 3.2,  "peak_hours": [11, 12, 13, 19, 20, 21], "pop_density": 6000, "holiday_boost": 1.5},
    "Mall":             {"base_fill_rate": 3.5,  "peak_hours": [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], "pop_density": 10000, "holiday_boost": 1.8},
    "Bus Stand":        {"base_fill_rate": 2.8,  "peak_hours": [7, 8, 9, 17, 18, 19], "pop_density": 7000, "holiday_boost": 1.1},
    "Railway Station":  {"base_fill_rate": 3.0,  "peak_hours": [6, 7, 8, 16, 17, 18, 19], "pop_density": 9000, "holiday_boost": 1.3},
    "Park":             {"base_fill_rate": 0.9,  "peak_hours": [6, 7, 17, 18, 19], "pop_density": 2000, "holiday_boost": 1.7},
    "Industrial":       {"base_fill_rate": 2.0,  "peak_hours": [8, 9, 10, 14, 15, 16], "pop_density": 3000, "holiday_boost": 0.2},
}

# Hyderabad public holidays (approximate 2023-2024)
HYDERABAD_HOLIDAYS = {
    "2024-01-01", "2024-01-26", "2024-03-25", "2024-03-29",
    "2024-04-14", "2024-04-17", "2024-04-21", "2024-05-23",
    "2024-06-17", "2024-08-15", "2024-10-02", "2024-10-12",
    "2024-10-13", "2024-10-14", "2024-11-01", "2024-11-15",
    "2024-12-25",
}

# Monsoon months in Hyderabad: June–October (higher rainfall, affects bin usage)
MONSOON_MONTHS = {6, 7, 8, 9, 10}


def generate_hourly_fill(bin_data, timestamp, current_fill, is_holiday, temperature, rainfall):
    """
    Simulates fill percentage increase for one hour, given bin context.
    Returns (new_fill, waste_generated).
    """
    params = AREA_PARAMS[bin_data["area_type"]]
    hour = timestamp.hour
    
    base_rate = params["base_fill_rate"]
    
    # Peak hour multiplier
    hour_multiplier = 1.8 if hour in params["peak_hours"] else 0.6
    
    # Holiday/weekend multiplier
    is_weekend = timestamp.weekday() >= 5
    if is_holiday:
        day_multiplier = params["holiday_boost"]
    elif is_weekend:
        day_multiplier = 1.1
    else:
        day_multiplier = 1.0
    
    # Temperature effect (higher temp = more waste/spoilage)
    temp_effect = 1.0 + max(0, (temperature - 28) * 0.02)
    
    # Rainfall effect (heavy rain suppresses outdoor activity)
    rain_effect = 1.0 - min(0.4, rainfall * 0.05)
    
    # Random natural variability (±15%)
    noise = np.random.normal(1.0, 0.15)
    
    # Final waste rate as percentage of capacity per hour
    capacity_liters = bin_data["cap"]
    fill_rate = (base_rate * hour_multiplier * day_multiplier * temp_effect * rain_effect * noise)
    waste_liters = fill_rate * (capacity_liters / 100.0)
    waste_liters = max(0, waste_liters)
    
    # Add waste to fill
    new_fill_liters = (current_fill / 100.0) * capacity_liters + waste_liters
    new_fill_pct = min(100.0, (new_fill_liters / capacity_liters) * 100.0)
    
    return new_fill_pct, waste_liters


def run_generation():
    """
    Main data generation pipeline.
    Creates 100 bins × 365 days × 24 hours of synthetic hourly readings.
    """
    print("=" * 60)
    print("  SMART WASTE MANAGEMENT - DATA GENERATOR")
    print("  City: Hyderabad, Telangana, India")
    print(f"  Bins: {len(HYDERABAD_BINS)}")
    print("  Period: 365 days")
    print(f"  Total records: {len(HYDERABAD_BINS) * 365 * 24:,}")
    print("=" * 60)
    
    init_db()
    db: Session = SessionLocal()
    
    try:
        # ── Clear existing data ──
        print("\n[1/5] Clearing existing data...")
        db.query(FillHistory).delete()
        db.query(Bin).delete()
        db.query(Truck).delete()
        db.query(Driver).delete()
        db.commit()
        
        # ── Insert Drivers ──
        print("[2/5] Inserting driver records...")
        for d in DRIVER_DETAILS:
            driver = Driver(
                driver_id=d["driver_id"],
                name=d["name"],
                phone=d["phone"],
                license_number=d["license"],
                status="Available"
            )
            db.add(driver)
        db.commit()
        
        # ── Insert Bins ──
        print("[3/5] Inserting 100 Hyderabad bin records...")
        installation_base = datetime.date(2022, 1, 1)
        for i, b in enumerate(HYDERABAD_BINS):
            install_date = installation_base + datetime.timedelta(days=random.randint(0, 180))
            bin_obj = Bin(
                bin_id=b["bin_id"],
                latitude=b["lat"],
                longitude=b["lon"],
                street_name=b["street"],
                area_name=b["area"],
                ward=b["ward"],
                ward_number=b["ward_num"],
                area_type=b["area_type"],
                capacity=b["cap"],
                current_fill_percentage=random.uniform(10, 60),
                battery_level=random.uniform(75, 100),
                signal_strength=random.randint(65, 98),
                temperature=None,
                status="Active",
                last_updated=None,
                last_collection_time=None,
                installation_date=install_date
            )
            db.add(bin_obj)
        db.commit()
        print(f"  [OK] Inserted {len(HYDERABAD_BINS)} bins")

        # ── Insert Trucks ──
        print("[4/5] Inserting truck fleet...")
        for t in TRUCK_FLEET:
            truck = Truck(
                truck_id=t["truck_id"],
                plate_number=t["plate"],
                capacity=t["capacity"],
                driver=t["driver"],
                driver_id=t["driver_id"],
                status="Idle"
            )
            db.add(truck)
        db.commit()
        print(f"  [OK] Inserted {len(TRUCK_FLEET)} trucks")
        
        # ── Generate Historical Fill Data ──
        print("[5/5] Generating 365 days of hourly fill history...")
        
        # Start date: 365 days ago
        start_dt = datetime.datetime.now().replace(
            hour=0, minute=0, second=0, microsecond=0
        ) - datetime.timedelta(days=365)
        
        BATCH_SIZE = 5000
        records_buffer = []
        total_records = 0
        
        # Track current fill state per bin
        bin_fill_state = {b["bin_id"]: random.uniform(5, 25) for b in HYDERABAD_BINS}
        
        # Simulate collection events: each bin collected every ~3-5 days randomly
        last_collection = {b["bin_id"]: start_dt for b in HYDERABAD_BINS}
        
        total_hours = 365 * 24
        for h in range(total_hours):
            current_dt = start_dt + datetime.timedelta(hours=h)
            date_str = current_dt.strftime("%Y-%m-%d")
            is_holiday = date_str in HYDERABAD_HOLIDAYS
            month = current_dt.month
            
            # Hyderabad climate simulation
            base_temp = 28 + 6 * np.sin(np.pi * (month - 3) / 6)  # Peak in May, low in Jan
            temperature = float(np.clip(np.random.normal(base_temp, 2.5), 18, 45))
            
            # Rainfall (monsoon: June–Oct)
            if month in MONSOON_MONTHS:
                rainfall = float(max(0, np.random.exponential(8)))
            else:
                rainfall = float(max(0, np.random.exponential(0.5)))
            
            for b in HYDERABAD_BINS:
                bin_id = b["bin_id"]
                current_fill = bin_fill_state[bin_id]
                
                # Simulate collection: if fill > 85% or > 4 days since last collection
                hours_since = (current_dt - last_collection[bin_id]).total_seconds() / 3600
                should_collect = (current_fill >= 85.0) or (hours_since >= random.randint(72, 120))
                if should_collect and current_fill > 20:
                    current_fill = random.uniform(2, 10)  # Reset after collection
                    last_collection[bin_id] = current_dt
                
                # Generate new fill
                new_fill, waste_gen = generate_hourly_fill(b, current_dt, current_fill, is_holiday, temperature, rainfall)
                bin_fill_state[bin_id] = new_fill
                
                pop_density = AREA_PARAMS[b["area_type"]]["pop_density"]
                
                records_buffer.append({
                    "bin_id": bin_id,
                    "timestamp": current_dt,
                    "fill_percentage": round(new_fill, 2),
                    "battery": round(random.uniform(75, 100), 1),
                    "temperature": round(temperature, 1),
                    "rainfall": round(rainfall, 2),
                    "holiday": int(is_holiday),
                    "population_density": pop_density,
                    "waste_generated": round(waste_gen, 2),
                })
            
            # Batch insert
            if len(records_buffer) >= BATCH_SIZE:
                db.bulk_insert_mappings(FillHistory, records_buffer)
                db.commit()
                total_records += len(records_buffer)
                records_buffer = []
                pct = (h / total_hours) * 100
                print(f"  Progress: {pct:.0f}% — {total_records:,} records written", end="\r")
        
        # Insert remaining
        if records_buffer:
            db.bulk_insert_mappings(FillHistory, records_buffer)
            db.commit()
            total_records += len(records_buffer)
        
        print(f"\n  [OK] Inserted {total_records:,} fill history records")
        print("\n" + "=" * 60)
        print("  DATA GENERATION COMPLETE!")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Data generation failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_generation()
