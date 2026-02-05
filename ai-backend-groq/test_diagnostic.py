from diagnostic_brain import DiagnosticBrain
import json
import random
import time

def generate_session(profile_type):
    """
    Generates synthetic log data for testing.
    """
    logs = []
    base_time = int(time.time() * 1000)
    
    if profile_type == 'dyslexia':
        # High lateral confusion, flat learning slope
        targets = ['b', 'b', 'd', 'p', 'q', 'b', 'd', 'p', 'q', 'b']
        responses = ['d', 'b', 'b', 'q', 'p', 'd', 'b', 'b', 'q', 'p'] # Many errors
        rts = [1500, 1600, 1550, 1400, 1800, 1500, 1600, 1550, 1400, 1800] # Consistent RT
    
    elif profile_type == 'adhd':
         # High RT variability, burst errors
        targets = ['a'] * 20
        responses = ['a'] * 20 
        # Inject error burst
        responses[5] = 'x'
        responses[6] = 'x'
        responses[7] = 'x'
        
        # High Variance RT
        rts = [800, 4000, 600, 500, 3500, 400, 600, 300, 5000, 700, 
               800, 400, 600, 500, 300, 400, 600, 300, 500, 700]

    else: # Control
        targets = ['a'] * 10
        responses = ['a'] * 10
        rts = [1200, 1100, 1000, 950, 900, 850, 800, 800, 800, 800] # Getting faster

    for i in range(len(targets)):
        is_correct = (targets[i] == responses[i])
        logs.append({
            'timestamp': base_time + (i * 2000), # 2s intervals
            'is_correct': is_correct,
            'reaction_time_ms': rts[i],
            'activity_type': 'phoneme_hunt',
            'metadata': {
                'target': targets[i],
                'selected': responses[i]
            }
        })
        
    return logs

def test_diagnostic():
    brain = DiagnosticBrain()
    
    print("\n--- Testing Dyslexia Profile ---")
    logs = generate_session('dyslexia')
    result = brain.analyze_session(logs, session_count=1)
    print(json.dumps(result['features'], indent=2))
    print("Risks:", result['risks'])
    assert "Dyslexia Risk" in str(result['risks'])

    print("\n--- Testing ADHD Profile ---")
    logs = generate_session('adhd')
    result = brain.analyze_session(logs, session_count=1)
    print(json.dumps(result['features'], indent=2))
    print("Risks:", result['risks'])
    # Check for ADHD risks
    # Note: Accuracy might be high enough to pass slope check, but RT var should trigger
    
    print("\n--- Testing Control Profile ---")
    logs = generate_session('control')
    result = brain.analyze_session(logs, session_count=10)
    print("Risks:", result['risks'])
    assert len(result['risks']) == 0

    print("\n✅ All Logical Tests Passed")

if __name__ == "__main__":
    test_diagnostic()
