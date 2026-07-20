import os
import json
import math
import pickle
import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
from database.db import engine
from ml.preprocessing.features import build_features

# Create directory for models if it doesn't exist
os.makedirs(os.path.join(os.path.dirname(__file__), "..", "models"), exist_ok=True)
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

def get_historical_dataframe():
    """Loads history joined with bin metadata from the database."""
    print("Loading data from database...")
    query = """
        SELECT 
            fh.timestamp, fh.bin_id, fh.fill_percentage, fh.temperature, 
            fh.rainfall, fh.holiday, fh.population_density, fh.waste_generated,
            b.capacity, b.area_type
        FROM fill_history fh
        JOIN bins b ON fh.bin_id = b.bin_id
    """
    df = pd.read_sql(query, con=engine)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df

def calculate_mape(y_true, y_pred):
    """Calculates Mean Absolute Percentage Error (handling 0s safely)."""
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    # Mask to prevent division by zero
    mask = y_true > 1.0
    if not np.any(mask):
        return 0.0
    return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100

def cdf_normal(x, mu, sigma):
    """Calculates the cumulative distribution function of a normal distribution."""
    if sigma <= 0:
        return 1.0 if x >= mu else 0.0
    return 0.5 * (1.0 + math.erf((x - mu) / (sigma * math.sqrt(2.0))))

def calculate_overflow_probability(predicted_fill, rmse, threshold=80.0):
    """Calculates the probability that the true fill level will be >= threshold."""
    # Probability that value >= threshold is 1 - CDF(threshold)
    prob = 1.0 - cdf_normal(threshold, mu=predicted_fill, sigma=rmse)
    return float(np.clip(prob, 0.0, 1.0))

def train_and_evaluate_models():
    """Trains and compares forecasting models, saving the best one."""
    raw_df = get_historical_dataframe()
    
    print("Building features...")
    df_features = build_features(raw_df, is_training=True)
    
    # One-hot encode area_type
    area_type_dummies = pd.get_dummies(df_features['area_type'], prefix='area')
    area_cols = area_type_dummies.columns.tolist()
    df_features = pd.concat([df_features, area_type_dummies], axis=1)
    
    # Define features
    feature_cols = [
        'capacity', 'temperature', 'rainfall', 'holiday', 'population_density',
        'hour', 'day_of_week', 'month', 'is_weekend', 'hours_since_collection',
        'fill_lag_1h', 'fill_lag_2h', 'fill_lag_24h',
        'fill_rolling_mean_6h', 'fill_rolling_std_6h',
        'fill_rolling_mean_24h', 'fill_rolling_std_24h',
        'temp_rain_interaction'
    ] + area_cols
    
    # Split into train (first 300 days) and test (remaining 65 days)
    # 300 days * 24 hours = 7200 hours
    max_train_date = df_features['timestamp'].min() + pd.Timedelta(days=300)
    
    train_mask = df_features['timestamp'] < max_train_date
    test_mask = ~train_mask
    
    X_train = df_features.loc[train_mask, feature_cols]
    y_train = df_features.loc[train_mask, 'target_fill_24h']
    
    X_test = df_features.loc[test_mask, feature_cols]
    y_test = df_features.loc[test_mask, 'target_fill_24h']
    
    # Also extract the baseline predictor (which is the current fill_percentage, i.e., fill_percentage at time T)
    y_test_baseline = df_features.loc[test_mask, 'fill_percentage']
    
    print(f"Train size: {X_train.shape[0]}, Test size: {X_test.shape[0]}")
    
    results = {}
    
    # 1. Baseline Model (Persistence: tomorrow = today's fill level)
    mae_base = mean_absolute_error(y_test, y_test_baseline)
    rmse_base = np.sqrt(mean_squared_error(y_test, y_test_baseline))
    mape_base = calculate_mape(y_test, y_test_baseline)
    r2_base = r2_score(y_test, y_test_baseline)
    results['Baseline (Persistence)'] = {
        'MAE': float(mae_base),
        'RMSE': float(rmse_base),
        'MAPE': float(mape_base),
        'R2': float(r2_base)
    }
    
    # 2. Linear Regression (Ridge)
    print("Training Ridge Regression...")
    ridge_model = Ridge(alpha=1.0)
    ridge_model.fit(X_train, y_train)
    y_pred_ridge = np.clip(ridge_model.predict(X_test), 0.0, 100.0)
    
    mae_ridge = mean_absolute_error(y_test, y_pred_ridge)
    rmse_ridge = np.sqrt(mean_squared_error(y_test, y_pred_ridge))
    mape_ridge = calculate_mape(y_test, y_pred_ridge)
    r2_ridge = r2_score(y_test, y_pred_ridge)
    results['Ridge Regression'] = {
        'MAE': float(mae_ridge),
        'RMSE': float(rmse_ridge),
        'MAPE': float(mape_ridge),
        'R2': float(r2_ridge)
    }
    
    # 3. XGBoost Regressor
    print("Training XGBoost Regressor...")
    xgb_model = xgb.XGBRegressor(
        n_estimators=150,
        learning_rate=0.08,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    xgb_model.fit(X_train, y_train)
    y_pred_xgb = np.clip(xgb_model.predict(X_test), 0.0, 100.0)
    
    mae_xgb = mean_absolute_error(y_test, y_pred_xgb)
    rmse_xgb = np.sqrt(mean_squared_error(y_test, y_pred_xgb))
    mape_xgb = calculate_mape(y_test, y_pred_xgb)
    r2_xgb = r2_score(y_test, y_pred_xgb)
    results['XGBoost Regressor'] = {
        'MAE': float(mae_xgb),
        'RMSE': float(rmse_xgb),
        'MAPE': float(mape_xgb),
        'R2': float(r2_xgb)
    }
    
    print("\n--- Model Comparison ---")
    print(pd.DataFrame(results).T.to_string())
    
    # Save the models and mapping details
    metadata = {
        "features": feature_cols,
        "area_cols": area_cols,
        "rmse": float(rmse_xgb),  # Used for computing overflow probability
        "results": results
    }
    
    # Save files
    with open(os.path.join(MODEL_DIR, "xgb_model.pkl"), "wb") as f:
        pickle.dump(xgb_model, f)
        
    with open(os.path.join(MODEL_DIR, "model_metadata.json"), "w") as f:
        json.dump(metadata, f, indent=4)
        
    print(f"Saved best model and metadata to {MODEL_DIR}")
    return results

if __name__ == "__main__":
    train_and_evaluate_models()
