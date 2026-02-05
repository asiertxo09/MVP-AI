import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

class DiagnosticFeatures:
    def __init__(self, events_log):
        """
        events_log: List of dictionaries containing:
            - timestamp: int (ms)
            - is_correct: bool
            - reaction_time_ms: int
            - activity_type: str
            - challenge: dict (optional, for lateral confusion)
        """
        self.df = pd.DataFrame(events_log)
        if not self.df.empty:
            self.df.sort_values('timestamp', inplace=True)
            # Ensure reaction_time_ms is numeric
            self.df['reaction_time_ms'] = pd.to_numeric(self.df['reaction_time_ms'], errors='coerce')

    def calculate_all(self):
        if self.df.empty:
            return {}
        
        return {
            'learning_slope': self.calculate_learning_slope(),
            'error_burst_rate': self.calculate_error_burst_rate(),
            'lateral_confusion_index': self.calculate_lateral_confusion(),
            'rt_variability_coefficient': self.calculate_rt_variability(),
            'total_trials': len(self.df),
            'accuracy_percentage': self.df['is_correct'].mean() * 100
        }

    def calculate_learning_slope(self):
        """
        Calculates the slope of accuracy over time (rolling average).
        Positive slope = Learning. Flat/Negative = Struggle.
        """
        if len(self.df) < 5:
            return 0.0

        # Create a rolling accuracy window
        self.df['rolling_acc'] = self.df['is_correct'].rolling(window=5, min_periods=1).mean()
        
        # Linear Regression: Time Step vs Rolling Accuracy
        X = np.arange(len(self.df)).reshape(-1, 1)
        y = self.df['rolling_acc'].fillna(0).values
        
        model = LinearRegression()
        model.fit(X, y)
        
        return float(model.coef_[0])

    def calculate_error_burst_rate(self):
        """
        Detects bursts of errors (e.g. 3+ errors within 5 seconds).
        High burst rate -> Attention deficit / Frustration.
        """
        if len(self.df) < 3:
            return 0.0
            
        errors = self.df[self.df['is_correct'] == False]
        if len(errors) < 2:
            return 0.0
        
        # Calculate time diffs between consecutive errors
        time_diffs = errors['timestamp'].diff()
        
        # Count "short gaps" (e.g., < 2000ms between errors)
        bursts = time_diffs[time_diffs < 2000].count()
        
        # Normalize by session duration (in minutes) approx
        duration_ms = self.df['timestamp'].max() - self.df['timestamp'].min()
        if duration_ms == 0: return 0.0
        
        duration_mins = duration_ms / 60000
        return float(bursts / duration_mins) if duration_mins > 0 else 0.0

    def calculate_lateral_confusion(self):
        """
        Counts errors specifically involving b/d/p/q confusion.
        Requires 'challenge' data in log.
        """
        lateral_pairs = [{'b', 'd'}, {'p', 'q'}, {'m', 'w'}]
        confusions = 0
        
        # This assumes metadata contains 'target_letter' and 'selected_letter'
        # Adjust logic based on actual capture format
        if 'metadata' not in self.df.columns:
            return 0.0

        for _, row in self.df.iterrows():
            if row['is_correct']: continue
            
            meta = row['metadata'] if isinstance(row['metadata'], dict) else {}
            target = meta.get('target', '')
            selected = meta.get('selected', '')
            
            if not target or not selected: continue
            
            pair = {target, selected}
            if pair in lateral_pairs:
                confusions += 1
                
        # Return probability of lateral error given an error
        total_errors = len(self.df[self.df['is_correct'] == False])
        return float(confusions / total_errors) if total_errors > 0 else 0.0

    def calculate_rt_variability(self):
        """
        Coefficient of Variation for RT: SD / Mean.
        High variability -> ADHD indicator.
        Exclude outliers (> 5s).
        """
        valid_rts = self.df[self.df['reaction_time_ms'] < 5000]['reaction_time_ms']
        if len(valid_rts) < 2:
            return 0.0
            
        mean_rt = valid_rts.mean()
        std_rt = valid_rts.std()
        
        if mean_rt == 0: return 0.0
        
        return float(std_rt / mean_rt)
