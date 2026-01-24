import requests
import json
import random

API_URL = "http://localhost:5001/api/generate-levels"

def test_mistake_prioritization():
    mistakes_to_test = ["S", "N", "M", "Q"]
    
    print(f"🧪 Testing Mistake Prioritization: {mistakes_to_test}...")
    
    payload = {
        "gameType": "phoneme",
        "difficulty": "easy",
        "limit": 4,
        "performance_context": {
            "mistakes": mistakes_to_test
        }
    }

    try:
        response = requests.post(API_URL, json=payload)
        
        if not response.ok:
            print(f"❌ API Error: {response.status_code} - {response.text}")
            return

        data = response.json()
        levels = data.get('levels', [])
        
        if not levels:
            print("❌ No levels returned")
            return

        print(f"✅ Received {len(levels)} items.")
        
        # Check if the target used matches one of our mistakes
        # Since we don't know EXACTLY which one it picked (it picks random from mistakes), 
        # we check if the generated words start with any of the mistake letters.
        
        correct_words = [item['word'] for item in levels if item.get('isTarget')]
        if not correct_words:
             print("❌ No correct words marked as isTarget")
             return

        first_word = correct_words[0]
        first_char = first_word[0].upper()
        
        if first_char in mistakes_to_test:
             print(f"✅ SUCCESS! AI generated a level for '{first_char}' (matches one of {mistakes_to_test})")
             print(f"Words: {correct_words}")
        else:
             print(f"⚠️ WARNING: Generated level for '{first_char}', but expected one of {mistakes_to_test}.")
             # Note: It *might* be valid if the AI failed to follow instruction or fell back, but we want to catch this.

    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_mistake_prioritization()
