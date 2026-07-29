import os
import sys
import random
import pickle
import json
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database.db import engine, SessionLocal
from ml.forecasting.models import cdf_normal, get_historical_dataframe
from ml.preprocessing.features import build_features
from optimization.vrp_solver.solver import solve_cvrp

def get_area_priority(area_type):
    mapping = {
        "Hospital": 1.0, "School": 0.9, "Restaurant": 0.9,
        "Market": 0.8, "Railway Station": 0.8, "Bus Stand": 0.8,
        "Mall": 0.7, "Commercial": 0.6, "Park": 0.4,
        "Residential": 0.3, "Industrial": 0.2
    }
    return mapping.get(area_type, 0.5)

def run_sensitivity(env='development'):
    config = {
        'development': {'days': 7, 'seeds': 2},
        'validation': {'days': 30, 'seeds': 5},
        'publication': {'days': 90, 'seeds': 10}
    }[env]
    
    print(f"Starting Sensitivity Analysis: {config['days']} days x {config['seeds']} seeds...")
    
    # Ablation settings for Priority Weights (Forecast, Uncertainty, Area)
    ablation_strategies = {
        "Only_Forecasting": (1.0, 0.0, 0.0),
        "Forecast_and_Uncertainty": (0.6, 0.4, 0.0),
        "Full_EcoBin_Proposed": (0.6, 0.2, 0.2)
    }
    
    # Sensitivity study for precise weight choices
    sensitivity_strategies = {
        "w_8_1_1": (0.8, 0.1, 0.1),
        "w_7_2_1": (0.7, 0.2, 0.1),
        "w_7_1_2": (0.7, 0.1, 0.2),
        "w_6_3_1": (0.6, 0.3, 0.1),
        "w_6_2_2": (0.6, 0.2, 0.2),
        "w_6_1_3": (0.6, 0.1, 0.3),
        "w_5_3_2": (0.5, 0.3, 0.2),
        "w_5_2_3": (0.5, 0.2, 0.3)
    }
    
    MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "ml", "models")
    with open(os.path.join(MODEL_DIR, "xgb_model.pkl"), "rb") as f:
        model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, "model_metadata.json"), "r") as f:
        metadata = json.load(f)
    rmse = metadata["rmse"]
    feature_cols = metadata["features"]
    
    from database.models import Bin, Truck
    db = SessionLocal()
    all_bins = [b.__dict__ for b in db.query(Bin).all()]
    all_trucks = [t.__dict__ for t in db.query(Truck).all()]
    truck_fleet = [{"truck_id": t["truck_id"], "capacity": t["capacity"], "driver": t["driver"]} for t in all_trucks]
    depot = {"latitude": 17.3850, "longitude": 78.4867}
    db.close()
    
    raw_df = get_historical_dataframe()
    df_features = build_features(raw_df, is_training=False)
    area_type_dummies = pd.get_dummies(df_features['area_type'], prefix='area')
    df_features = pd.concat([df_features, area_type_dummies], axis=1)
    
    max_train_date = df_features['timestamp'].min() + pd.Timedelta(days=300)
    test_df = df_features[df_features['timestamp'] >= max_train_date].copy()
    test_df['date'] = test_df['timestamp'].dt.date
    available_dates = test_df['date'].unique()
    
    start_of_day_mask = test_df['timestamp'].dt.hour == 0
    df_start_day = test_df[start_of_day_mask].copy()
    X_pred = df_start_day[feature_cols]
    df_start_day['predicted_fill_24h'] = np.clip(model.predict(X_pred), 0.0, 100.0)
    
    pred_lookup = {}
    for _, row in df_start_day.iterrows():
        d = row['date']
        if d not in pred_lookup: pred_lookup[d] = {}
        pred_lookup[d][row['bin_id']] = row['predicted_fill_24h']
        
    waste_lookup = {}
    for d in available_dates:
        day_data = test_df[test_df['date'] == d]
        waste_lookup[d] = day_data.groupby('bin_id')['waste_generated'].apply(list).to_dict()
        
    initial_fills = {}
    first_test_date = available_dates[0]
    for _, row in df_start_day[df_start_day['date'] == first_test_date].iterrows():
        initial_fills[row['bin_id']] = row['fill_percentage']
        
    def run_strategy_group(strategies, exp_name):
        results = []
        for seed in range(config['seeds']):
            random.seed(seed)
            np.random.seed(seed)
            state = {s: initial_fills.copy() for s in strategies.keys()}
            sampled_dates = random.choices(available_dates, k=config['days'])
            
            for day_idx, d in enumerate(sampled_dates):
                for strategy, weights in strategies.items():
                    w_fcst, w_unc, w_area = weights
                    bins_to_collect = []
                    
                    for b in all_bins:
                        bid = b["bin_id"]
                        current_fill = state[strategy][bid]
                        
                        hist_start = df_start_day[(df_start_day['date'] == d) & (df_start_day['bin_id'] == bid)]['fill_percentage'].values[0]
                        hist_pred = pred_lookup[d][bid]
                        adjusted_pred = min(100.0, max(0.0, hist_pred + (current_fill - hist_start)))
                        
                        prob = 1.0 - cdf_normal(80.0, mu=adjusted_pred, sigma=rmse)
                        area_prio = get_area_priority(b["area_type"])
                        
                        priority = (adjusted_pred * w_fcst) + (prob * 100 * w_unc) + (area_prio * 100 * w_area)
                        if adjusted_pred >= 80.0 or priority >= 75.0:
                            bins_to_collect.append({
                                "bin_id": bid, "latitude": b["latitude"], "longitude": b["longitude"],
                                "capacity": b["capacity"], "current_fill_liters": b["capacity"] * (current_fill / 100.0)
                            })
                            
                    metrics = solve_cvrp(depot, bins_to_collect, truck_fleet)
                    collected_bin_ids = set()
                    for r in metrics.get("routes", {}).values():
                        for node in r["path"]:
                            if node["bin_id"] != "DEPOT":
                                collected_bin_ids.add(node["bin_id"])
                                
                    unnecessary_collections = 0
                    total_collections = len(collected_bin_ids)
                    fill_at_collection = []
                    
                    for bid in collected_bin_ids:
                        fill = state[strategy][bid]
                        fill_at_collection.append(fill)
                        if fill < 40.0:
                            unnecessary_collections += 1
                        state[strategy][bid] = random.uniform(2.0, 10.0)
                        
                    overflow_events = 0
                    overflow_bin_hours = 0
                    
                    for bid in state[strategy]:
                        b_capacity = next(b["capacity"] for b in all_bins if b["bin_id"] == bid)
                        waste_seq = waste_lookup[d].get(bid, [0]*24)
                        
                        was_overflow = state[strategy][bid] >= 80.0
                        for w in waste_seq:
                            state[strategy][bid] += (w / b_capacity) * 100
                            is_overflow = state[strategy][bid] >= 80.0
                            
                            if is_overflow:
                                overflow_bin_hours += 1
                                if not was_overflow:
                                    overflow_events += 1
                            was_overflow = is_overflow
                            
                    results.append({
                        "Seed": seed,
                        "Day": day_idx,
                        "Variant": strategy,
                        "Distance_km": metrics.get("total_distance_km", 0),
                        "Utilization_pct": metrics.get("truck_utilization_pct", 0),
                        "Bins_Collected": total_collections,
                        "Unnecessary_Collections": unnecessary_collections,
                        "Overflow_Events": overflow_events,
                        "Overflow_Bin_Hours": overflow_bin_hours
                    })
                    
        df_results = pd.DataFrame(results)
        EXP_DIR = os.path.join(os.path.dirname(__file__), "..", "experiments", "results")
        os.makedirs(EXP_DIR, exist_ok=True)
        
        agg_funcs = {
            "Distance_km": ['mean', 'std'],
            "Overflow_Events": ['mean', 'std'],
            "Overflow_Bin_Hours": ['mean', 'std'],
            "Utilization_pct": ['mean', 'std'],
            "Unnecessary_Collections": ['mean']
        }
        
        agg_df = df_results.groupby("Variant").agg(agg_funcs)
        agg_df.columns = ['_'.join(col) for col in agg_df.columns]
        agg_df.to_csv(os.path.join(EXP_DIR, f"{exp_name}_results.csv"))
        return agg_df

    # Run Ablation
    print("Running Ablation Study...")
    run_strategy_group(ablation_strategies, "ablation")
    
    # Run Sensitivity
    print("Running Sensitivity Study...")
    run_strategy_group(sensitivity_strategies, "sensitivity")
    
    print(f"Sensitivity and Ablation analyses completed.")

if __name__ == "__main__":
    run_sensitivity('development')
