import pandas as pd
import numpy as np

def detect_collections(df, threshold=-30.0):
    """
    Detects collection events where fill_percentage drops significantly from one hour to the next.
    Adds a 'is_collected' boolean column.
    """
    df = df.sort_values(['bin_id', 'timestamp'])
    df['fill_diff'] = df.groupby('bin_id')['fill_percentage'].diff()
    df['is_collected'] = (df['fill_diff'] <= threshold).astype(int)
    df.drop(columns=['fill_diff'], inplace=True, errors='ignore')
    return df

def calculate_hours_since_collection(df):
    """
    Calculates the number of hours elapsed since the last collection event for each record.
    Uses vector operations for speed.
    """
    df = df.sort_values(['bin_id', 'timestamp'])
    
    # Identify collection events
    df['is_collected_event'] = (df.groupby('bin_id')['fill_percentage'].diff() <= -30.0).astype(int)
    
    # Cumulative sum of collection events per bin to create groups
    df['collection_group'] = df.groupby('bin_id')['is_collected_event'].cumsum()
    
    # Calculate hours elapsed since the start of each collection group
    df['hours_since_collection'] = df.groupby(['bin_id', 'collection_group']).cumcount()
    
    # Clean up temporary columns
    df.drop(columns=['is_collected_event', 'collection_group'], inplace=True)
    return df

def build_features(df, is_training=True):
    """
    Builds lag, rolling, and temporal features.
    
    If is_training=True:
        - Calculates the target variable 'target_fill_24h' (fill level 24 hours later).
        - Filters out records where a collection event occurred within the next 24 hours.
          This teaches the model how the bin accumulates waste when NOT collected, 
          which is exactly what we need to predict overflow risk.
    """
    # Sort data
    df = df.sort_values(['bin_id', 'timestamp']).copy()
    
    # Calculate hours since last collection
    df = calculate_hours_since_collection(df)
    
    # 1. Temporal Features
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_week'] = df['timestamp'].dt.dayofweek
    df['month'] = df['timestamp'].dt.month
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
    
    # 2. Lag Features
    # Since we sort by bin_id and timestamp, we shift within each bin group
    df['fill_lag_1h'] = df.groupby('bin_id')['fill_percentage'].shift(1)
    df['fill_lag_2h'] = df.groupby('bin_id')['fill_percentage'].shift(2)
    df['fill_lag_24h'] = df.groupby('bin_id')['fill_percentage'].shift(24)
    
    # 3. Rolling Features
    # Calculate rolling mean and std of fill_percentage over past 6h and 24h
    # Shift by 1 first so we don't leak the current fill_percentage into the rolling calculation
    # (actually, current fill is known at inference time, so we roll on current fill, but let's shift 1 if needed.
    #  Since we know current fill, we can include it)
    df['fill_rolling_mean_6h'] = df.groupby('bin_id')['fill_percentage'].transform(lambda x: x.rolling(6, min_periods=1).mean())
    df['fill_rolling_std_6h'] = df.groupby('bin_id')['fill_percentage'].transform(lambda x: x.rolling(6, min_periods=1).std().fillna(0))
    df['fill_rolling_mean_24h'] = df.groupby('bin_id')['fill_percentage'].transform(lambda x: x.rolling(24, min_periods=1).mean())
    df['fill_rolling_std_24h'] = df.groupby('bin_id')['fill_percentage'].transform(lambda x: x.rolling(24, min_periods=1).std().fillna(0))
    
    # 4. Interaction Features
    df['temp_rain_interaction'] = df['temperature'] * df['rainfall']
    
    # Drop rows with NaN due to lags
    df.dropna(subset=['fill_lag_24h', 'fill_lag_1h', 'fill_lag_2h'], inplace=True)
    
    if is_training:
        # Create target: fill percentage 24 hours in the future
        df['target_fill_24h'] = df.groupby('bin_id')['fill_percentage'].shift(-24)
        
        # Identify if any collection occurred in the NEXT 24 hours
        # If the minimum hours_since_collection in the next 24 hours is less than the current, 
        # or if is_collected (diff <= -30) occurred, it means a collection happened.
        # Simple check: shift is_collected backwards by 1 to 24 steps and take max
        df['is_collected_event'] = (df.groupby('bin_id')['fill_percentage'].diff() <= -30.0).astype(int)
        
        # Roll backward to see if any collection happens in the next 24 hours
        # We can shift 'is_collected_event' backwards from 1 to 24 hours
        collection_in_next_24h = np.zeros(len(df), dtype=int)
        for shift_val in range(1, 25):
            collection_in_next_24h = np.maximum(
                collection_in_next_24h, 
                df.groupby('bin_id')['is_collected_event'].shift(-shift_val).fillna(0).astype(int).values
            )
            
        df['collection_in_next_24h'] = collection_in_next_24h
        
        # Drop rows where a collection happened in the next 24h
        # (This keeps only the continuous accumulation phases for clean forecasting)
        train_df = df[df['collection_in_next_24h'] == 0].copy()
        
        # Drop temporary columns and target NaNs
        train_df.dropna(subset=['target_fill_24h'], inplace=True)
        train_df.drop(columns=['is_collected_event', 'collection_in_next_24h'], inplace=True)
        return train_df
    
    return df
