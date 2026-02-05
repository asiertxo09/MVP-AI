from diagnostic_features import DiagnosticFeatures
from sklearn.ensemble import IsolationForest
import numpy as np

class DiagnosticBrain:
    def __init__(self):
        # Layer 1: Clinical Rules Thresholds
        self.RULES = {
            'dyslexia': {
                'lateral_confusion_index': 0.2, # > 20% of errors are b/d/p/q
                'learning_slope': 0.001        # Slope < 0.001 (Flat/Negative)
            },
            'adhd': {
                'rt_variability_coefficient': 0.45, # High variability
                'error_burst_rate': 0.5            # High burst rate
            },
            'dyscalculia': {
                'accuracy_percentage': 60 # Low accuracy (placeholder)
            }
        }
        
        # Layer 2: Anomaly Detection Model (Stub)
        # In prod, this would load a pretrained model
        self.anomaly_model = IsolationForest(contamination=0.1, random_state=42)
        self.is_model_trained = False

    def train_anomaly_model(self, historical_features):
        """
        Train the isolation forest on a batch of feature vectors (e.g. from all users).
        historical_features: List of [slope, burst, lateral, var] lists
        """
        if len(historical_features) > 10:
            self.anomaly_model.fit(historical_features)
            self.is_model_trained = True

    def analyze_session(self, session_logs, session_count=1):
        """
        Main entry point.
        """
        if not session_logs:
            return {"error": "No logs provided"}

        # 1. Feature Extraction
        extractor = DiagnosticFeatures(session_logs)
        features = extractor.calculate_all()
        
        if not features:
            return {"error": "Insufficient data"}

        # 2. Layer 1: Rule-Based Classification
        risks = []
        
        # Dyslexia Check
        if features.get('lateral_confusion_index', 0) > self.RULES['dyslexia']['lateral_confusion_index']:
             risks.append("Dyslexia Risk (High Lateral Confusion)")
        if features.get('learning_slope', 0) < self.RULES['dyslexia']['learning_slope']:
             risks.append("Dyslexia Risk (Learning Plateau)")

        # ADHD Check
        if features.get('rt_variability_coefficient', 0) > self.RULES['adhd']['rt_variability_coefficient']:
             risks.append("ADHD Risk (High RT Variability)")
        if features.get('error_burst_rate', 0) > self.RULES['adhd']['error_burst_rate']:
             risks.append("ADHD Risk (Attentional Lapses)")

        # 3. Layer 2: Anomaly Detection
        anomaly_score = 0
        if self.is_model_trained:
            vector = [[
                features.get('learning_slope', 0),
                features.get('error_burst_rate', 0),
                features.get('lateral_confusion_index', 0),
                features.get('rt_variability_coefficient', 0)
            ]]
            pred = self.anomaly_model.predict(vector) # -1 for outlier
            if pred[0] == -1:
                risks.append(" atypical_play_pattern (Statistical Anomaly)")
                anomaly_score = 1

        # 4. Layer 3: Confidence Weighting
        confidence = "Low"
        if session_count > 5: confidence = "Medium"
        if session_count > 10: confidence = "High"

        # 5. Generate Text Report
        report = self.generate_report(features, risks, confidence)
        
        return {
            "features": features,
            "risks": risks,
            "confidence": confidence,
            "report": report
        }

    def generate_report(self, features, risks, confidence):
        report = f"## Reporte Clínico Automático (Confianza: {confidence})\n\n"
        
        report += "### Biomarcadores Digitales:\n"
        report += f"- **Pendiente de Aprendizaje**: {features.get('learning_slope', 0):.4f}\n"
        report += f"- **Variabilidad TR**: {features.get('rt_variability_coefficient', 0):.2f}\n"
        report += f"- **Índice Confusión Lateral**: {features.get('lateral_confusion_index', 0):.2f}\n\n"
        
        if not risks:
            report += "### Conclusión:\n"
            report += "El perfil del estudiante se encuentra dentro de los parámetros neurotípicos esperados para su edad y volumen de juego."
        else:
            report += "### Alertas Detectadas:\n"
            for r in risks:
                report += f"- ⚠️ {r}\n"
            
            report += "\n### Recomendación:\n"
            if "Dyslexia" in str(risks):
                report += "Se sugiere reforzar ejercicios de conciencia fonológica y rastreo visual."
            if "ADHD" in str(risks):
                report += "Se sugiere implementar micro-pausas y reducir la duración de las sesiones (pomodoro gamificado)."
                
        return report
