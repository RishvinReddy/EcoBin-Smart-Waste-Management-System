"""
Smart Waste Management Platform — Full Pipeline Runner
Municipal Corporation of Hyderabad — AI Routing Engine

Runs the complete end-to-end ML and optimization pipeline:
  1. Database schema initialization
  2. Synthetic data generation (100 Hyderabad bins × 365 days)
  3. XGBoost model training and evaluation
  4. 24h fill-level predictions for all bins
  5. CVRP route optimization (Google OR-Tools)
  6. Summary metrics output

Usage:
    python run_pipeline.py
    python run_pipeline.py --skip-data    # Skip data generation if data exists
    python run_pipeline.py --force-data   # Force regeneration of all data
"""
import os
import sys
import json
import datetime
import argparse

from database.db import init_db, SessionLocal
from database.models import Bin, FillHistory, Prediction, OptimizedRoute, Truck, Driver
from ml.data_generator.generator import run_generation
from ml.forecasting.models import train_and_evaluate_models

def main():
    parser = argparse.ArgumentParser(description='Smart Waste Management Pipeline Runner')
    parser.add_argument('--skip-data', action='store_true', help='Skip data generation even if DB is empty')
    parser.add_argument('--force-data', action='store_true', help='Force regeneration of all data')
    parser.add_argument('--skip-train', action='store_true', help='Skip model training')
    args = parser.parse_args()

    print("=" * 65)
    print("  AI-Powered Smart Waste Management Platform v2.0")
    print("  Municipal Corporation of Hyderabad, Telangana, India")
    print("=" * 65)
    print()

    # ── 1. Database Init ──────────────────────────────────────
    print("[1/5] Initializing database schema...")
    
    # Check if database has schema errors by running a test query
    need_rebuild = False
    try:
        init_db()
        db_test = SessionLocal()
        # Test if we can query the bins table with the new columns
        test_bin = db_test.query(Bin).first()
        db_test.close()
    except Exception as e:
        print(f"  [WARN] Database schema mismatch or error detected: {e}")
        print("  [WARN] Rebuilding database schema to match the new Hyderabad layout...")
        need_rebuild = True
    
    if need_rebuild:
        from database.models import Base
        from database.db import engine
        # Close all connections first
        SessionLocal.close_all()
        # Drop all tables
        Base.metadata.drop_all(bind=engine)
        # Recreate tables
        Base.metadata.create_all(bind=engine)
        print("  [OK] Database schema rebuilt successfully.")

    db = SessionLocal()
    try:
        # Check and generate data
        try:
            bin_count = db.query(Bin).count()
            history_count = db.query(FillHistory).count()
        except Exception:
            # Fallback if query still fails
            print("  [WARN] Query failed, forcing database schema reset...")
            from database.models import Base
            from database.db import engine
            db.close()
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()
            bin_count = 0
            history_count = 0

        print(f"  Current database state:")
        print(f"  |- Bins: {bin_count}")
        print(f"  +- Fill history records: {history_count:,}")
        print()

        # ── 2. Data Generation ────────────────────────────────
        should_generate = (
            args.force_data or need_rebuild or
            (not args.skip_data and (bin_count == 0 or bin_count != 100 or history_count < 100000))
        )
        
        if should_generate:
            print("[2/5] Generating 100-bin Hyderabad synthetic dataset...")
            print("      100 bins × 365 days × 24 hrs = ~876,000 records")
            print("      Estimated time: 2-4 minutes...")
            print()
            run_generation()
            print("  [OK] Data generation complete")
        else:
            print(f"[2/5] Dataset exists ({bin_count} bins, {history_count:,} records). Skipping generation.")
            print("      Use --force-data to regenerate.")
        print()

        # ── 3. Model Training ─────────────────────────────────
        model_path = os.path.join(os.path.dirname(__file__), "ml", "models", "xgb_model.pkl")
        meta_path = os.path.join(os.path.dirname(__file__), "ml", "models", "model_metadata.json")
        
        if not os.path.exists(model_path) and not args.skip_train:
            print("[3/5] Training XGBoost forecasting model...")
            print("      Comparing: Linear Regression | Ridge | XGBoost Regressor")
            train_and_evaluate_models()
            print("  [OK] Training complete — model saved to ml/models/xgb_model.pkl")
        elif args.skip_train:
            print("[3/5] Skipping model training (--skip-train)")
        else:
            print("[3/5] Trained model found. Skipping. (Delete ml/models/xgb_model.pkl to retrain)")
        print()

        # ── 4. Predictions ────────────────────────────────────
        print("[4/5] Generating 24h fill-level predictions...")
        if not os.path.exists(meta_path):
            print("  [WARN] Model metadata not found. Run without --skip-train first.")
        else:
            import pickle
            import numpy as np
            import pandas as pd
            from sqlalchemy import func
            from database.db import engine
            from ml.preprocessing.features import build_features
            from ml.forecasting.models import calculate_overflow_probability

            with open(model_path, "rb") as f:
                model = pickle.load(f)
            with open(meta_path, "r") as f:
                metadata = json.load(f)

            feature_cols = metadata["features"]
            area_cols = metadata["area_cols"]
            rmse = metadata["rmse"]

            max_ts = db.query(func.max(FillHistory.timestamp)).scalar()
            if max_ts:
                start_date = max_ts - datetime.timedelta(days=3)
                query = f"""
                    SELECT fh.timestamp, fh.bin_id, fh.fill_percentage, fh.temperature,
                           fh.rainfall, fh.holiday, fh.population_density, fh.waste_generated,
                           b.capacity, b.area_type
                    FROM fill_history fh
                    JOIN bins b ON fh.bin_id = b.bin_id
                    WHERE fh.timestamp >= '{start_date.isoformat()}'
                """
                df = pd.read_sql(query, con=engine)
                df['timestamp'] = pd.to_datetime(df['timestamp'])
                df_features = build_features(df, is_training=False)
                latest_idx = df_features.groupby('bin_id')['timestamp'].idxmax()
                df_latest = df_features.loc[latest_idx].copy()
                pred_times = df_latest['timestamp'] + pd.Timedelta(hours=24)
                df_latest['timestamp'] = pred_times
                df_latest['hour'] = df_latest['timestamp'].dt.hour
                df_latest['day_of_week'] = df_latest['timestamp'].dt.dayofweek
                df_latest['month'] = df_latest['timestamp'].dt.month
                from ml.preprocessing.calendar_features import is_public_holiday
                df_latest['is_weekend'] = (df_latest['day_of_week'] >= 5).astype(int)
                df_latest['holiday'] = df_latest['timestamp'].apply(is_public_holiday)
                for col in area_cols:
                    area_name = col.replace("area_", "")
                    df_latest[col] = (df_latest['area_type'] == area_name).astype(int)
                X_pred = df_latest[feature_cols]
                preds = np.clip(model.predict(X_pred), 0.0, 100.0)
                db.query(Prediction).delete()
                from database.models import Prediction as PredModel
                for bin_id, pt, pf in zip(df_latest['bin_id'], pred_times, preds):
                    op = calculate_overflow_probability(float(pf), rmse, threshold=80.0)
                    db.add(PredModel(bin_id=bin_id, prediction_time=pt.to_pydatetime(), predicted_fill=float(pf), overflow_probability=op))
                db.commit()
                critical = sum(1 for p in preds if p >= 80)
                print(f"  [OK] Predictions generated for {len(df_latest)} bins")
                print(f"  [OK] {critical} bins predicted to overflow in next 24 hours")
            else:
                print("  [FAIL] No historical data found.")
        print()

        # ── 5. Route Optimization ─────────────────────────────
        print("[5/5] Running CVRP route optimization (Google OR-Tools)...")
        from database.models import Prediction as PredModel, Truck as TruckModel
        from optimization.vrp_solver.solver import solve_cvrp, simulate_fixed_schedule

        preds_q = db.query(PredModel, Bin).join(Bin, PredModel.bin_id == Bin.bin_id).all()
        bins_to_collect = []
        for pred, b in preds_q:
            if pred.predicted_fill >= 80.0 or (pred.overflow_probability * 100) >= 75.0:
                bins_to_collect.append({
                    "bin_id": b.bin_id, "latitude": b.latitude, "longitude": b.longitude,
                    "capacity": b.capacity, "current_fill_liters": b.capacity * (pred.predicted_fill / 100.0)
                })

        trucks_q = db.query(TruckModel).all()
        truck_fleet = [{"truck_id": t.truck_id, "capacity": t.capacity, "driver": t.driver} for t in trucks_q]
        depot = {"latitude": 17.3850, "longitude": 78.4867}

        results = solve_cvrp(depot, bins_to_collect, truck_fleet)
        results = solve_cvrp(depot, bins_to_collect, truck_fleet)

        db.query(OptimizedRoute).delete()
        today = datetime.date.today()
        for truck_id, route_info in results.get("routes", {}).items():
            from database.models import OptimizedRoute as RouteModel
            db.add(RouteModel(
                truck_id=truck_id, date=today,
                distance=route_info["distance_km"], fuel=round(route_info["distance_km"] * 0.3, 2),
                duration=round((route_info["distance_km"] / 30.0) + (len(route_info["path"]) * 10 / 60.0), 2),
                route_path=json.dumps(route_info["path"])
            ))
        db.commit()

        print(f"  [OK] Optimized routes for {len(results.get('routes', {}))} trucks.")

        # ── 6. Residual Analysis ─────────────────────────────
        print("[6/8] Running Residual Analysis...")
        import ml.forecasting.residual_analysis as res_analysis
        res_analysis.analyze_residuals()
        print()
        
        # ── 7. Experiment Runner ─────────────────────────────
        print("[7/8] Running Experiment Runner (Simulation vs Baselines)...")
        import optimization.experiment_runner as exp_runner
        exp_runner.run_experiments('smoke')
        print()
        
        # ── 8. Sensitivity Analysis ──────────────────────────
        print("[8/8] Running Sensitivity & Ablation Analysis...")
        import optimization.sensitivity_analysis as sens
        sens.run_sensitivity('smoke')
        print()
        
        # ── Summary ──────────────────────────────────────────
        print("🎉 Full AI Routing Pipeline & Experiments Completed Successfully!")
        print("To start the backend server:")
        print("  cd backend && uvicorn main:app --reload")

        print()
        print("=" * 65)
        print("  PIPELINE COMPLETE — EVALUATION SUMMARY")
        print("=" * 65)
        print("  -> Start server:  python -m uvicorn backend.main:app --reload --port 8000")
        print("  -> Dashboard:     http://localhost:5173")
        print("  -> Swagger Docs:  http://127.0.0.1:8000/docs")
        print("=" * 65)

    except Exception as e:
        print(f"\n[ERROR] Pipeline failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
