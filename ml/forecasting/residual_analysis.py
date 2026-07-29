import os
import sys
import pickle
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import scipy.stats as stats
from sklearn.calibration import calibration_curve
from sklearn.metrics import brier_score_loss

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from ml.forecasting.models import get_historical_dataframe, cdf_normal
from ml.preprocessing.features import build_features

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
EXPERIMENT_FIG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "experiments", "figures")
EXPERIMENT_RES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "experiments", "results")

os.makedirs(EXPERIMENT_FIG_DIR, exist_ok=True)
os.makedirs(EXPERIMENT_RES_DIR, exist_ok=True)

def analyze_residuals():
    print("Loading model and metadata...")
    with open(os.path.join(MODEL_DIR, "xgb_model.pkl"), "rb") as f:
        model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, "model_metadata.json"), "r") as f:
        metadata = json.load(f)
        
    feature_cols = metadata["features"]
    rmse_meta = metadata["rmse"]
    
    print("Loading and preparing test data...")
    raw_df = get_historical_dataframe()
    df_features = build_features(raw_df, is_training=True)
    
    area_type_dummies = pd.get_dummies(df_features['area_type'], prefix='area')
    df_features = pd.concat([df_features, area_type_dummies], axis=1)
    
    max_train_date = df_features['timestamp'].min() + pd.Timedelta(days=300)
    test_mask = df_features['timestamp'] >= max_train_date
    
    X_test = df_features.loc[test_mask, feature_cols]
    y_test = df_features.loc[test_mask, 'target_fill_24h']
    areas_test = df_features.loc[test_mask, 'area_type']
    
    print("Generating predictions...")
    y_pred = np.clip(model.predict(X_test), 0.0, 100.0)
    
    # 1. Residual Calculations
    residuals = y_test - y_pred
    res_mean = np.mean(residuals)
    res_std = np.std(residuals)
    print(f"Residual Mean: {res_mean:.4f}, Std: {res_std:.4f}")
    
    # Set plot style
    sns.set_theme(style="whitegrid")
    
    # 2. Residual Histogram
    plt.figure(figsize=(8, 5))
    sns.histplot(residuals, bins=50, kde=True, color='purple')
    plt.axvline(x=0, color='red', linestyle='--')
    plt.title('Residual Histogram (Error = True - Predicted)')
    plt.xlabel('Residual Error (Fill %)')
    plt.savefig(os.path.join(EXPERIMENT_FIG_DIR, "residual_histogram.png"))
    plt.close()
    
    # 3. Q-Q Plot
    plt.figure(figsize=(6, 6))
    stats.probplot(residuals, dist="norm", plot=plt)
    plt.title('Q-Q Plot of Forecast Residuals')
    plt.savefig(os.path.join(EXPERIMENT_FIG_DIR, "qq_plot.png"))
    plt.close()
    
    # 4. Residual vs Fitted (Heteroscedasticity)
    plt.figure(figsize=(8, 5))
    sns.scatterplot(x=y_pred, y=residuals, alpha=0.3, s=15, color='teal')
    plt.axhline(y=0, color='red', linestyle='--')
    plt.title('Residual vs Fitted Values')
    plt.xlabel('Predicted Fill (%)')
    plt.ylabel('Residual Error')
    plt.savefig(os.path.join(EXPERIMENT_FIG_DIR, "residual_vs_fitted.png"))
    plt.close()
    
    # 5. Residuals by Area Type
    plt.figure(figsize=(10, 6))
    sns.boxplot(x=areas_test, y=residuals, palette="Set3")
    plt.xticks(rotation=45)
    plt.axhline(y=0, color='red', linestyle='--')
    plt.title('Residuals Distribution by Area Type')
    plt.xlabel('Area Type')
    plt.ylabel('Residual Error')
    plt.tight_layout()
    plt.savefig(os.path.join(EXPERIMENT_FIG_DIR, "residuals_by_area.png"))
    plt.close()
    
    # 6. Empirical Overflow Calibration (Threshold = 80%)
    # P(F >= 80) = 1 - CDF(80)
    print("Calculating probability calibration...")
    probs = [1.0 - cdf_normal(80.0, mu=p, sigma=rmse_meta) for p in y_pred]
    y_test_binary = (y_test >= 80.0).astype(int)
    
    # Brier Score
    brier = brier_score_loss(y_test_binary, probs)
    print(f"Brier Score for Overflow Probability: {brier:.4f}")
    
    # Calibration Curve
    prob_true, prob_pred = calibration_curve(y_test_binary, probs, n_bins=10)
    
    plt.figure(figsize=(6, 6))
    plt.plot(prob_pred, prob_true, marker='o', label='XGBoost Gaussian P(Overflow)')
    plt.plot([0, 1], [0, 1], linestyle='--', color='gray', label='Perfectly Calibrated')
    plt.title('Calibration Curve for Overflow Probability (>=80%)')
    plt.xlabel('Mean Predicted Probability')
    plt.ylabel('Fraction of True Overflows')
    plt.legend()
    plt.savefig(os.path.join(EXPERIMENT_FIG_DIR, "calibration_curve.png"))
    plt.close()
    
    # Save residual summary metrics
    results_summary = {
        "residual_mean": float(res_mean),
        "residual_std": float(res_std),
        "brier_score": float(brier),
        "rmse_metadata_used": float(rmse_meta)
    }
    
    with open(os.path.join(EXPERIMENT_RES_DIR, "residual_analysis.json"), "w") as f:
        json.dump(results_summary, f, indent=4)
        
    print(f"Residual analysis completed. Plots saved to {EXPERIMENT_FIG_DIR}")

if __name__ == "__main__":
    analyze_residuals()
