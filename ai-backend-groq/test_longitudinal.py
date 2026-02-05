from longitudinal_logic import SpiralingEngine, SkillGraph
import time

def test_skill_graph():
    print("\n--- Testing Skill Graph (Gatekeeping) ---")
    graph = SkillGraph()
    
    # Case 1: Fluency blocked (Missing Decoding)
    req1 = graph.validate_level_request("fluency", {"decoding": False})
    print(f"Request 'Fluency' (No Decoding): {req1}")
    assert req1['allowed'] == False
    assert req1['bridge_skill'] == 'decoding'

    # Case 2: Fluency allowed (Have Decoding)
    req2 = graph.validate_level_request("fluency", {"decoding": True})
    print(f"Request 'Fluency' (Has Decoding): {req2}")
    assert req2['allowed'] == True

    # Case 3: Blending blocked (Missing Segmentation)
    req3 = graph.validate_level_request("blending", {"segmentation": False})
    print(f"Request 'Blending' (No Segmentation): {req3}")
    assert req3['allowed'] == False

    print("✅ Skill Graph Tests Passed")

def test_spiraling_engine():
    print("\n--- Testing Spiraling Engine (Review Injection) ---")
    engine = SpiralingEngine(high_decay_days=14)
    current_time = int(time.time() * 1000)
    day_ms = 24*3600*1000
    
    # Set up history
    history = {
        "m": current_time - (20 * day_ms), # 20 days ago (Should Review)
        "p": current_time - (2 * day_ms),  # 2 days ago (Recent)
        "t": current_time - (15 * day_ms)  # 15 days ago (Should Review)
    }
    
    # Case 1: only Decay
    reviews = engine.get_review_items(history, mistakes=[])
    print(f"History (M: -20d, P: -2d, T: -15d) -> Reviews: {reviews}")
    assert "m" in reviews
    assert "t" in reviews
    assert "p" not in reviews

    # Case 2: Mistakes Priority
    reviews_mistakes = engine.get_review_items(history, mistakes=["p"])
    print(f"Mistake on 'P' -> Reviews: {reviews_mistakes}")
    assert "p" in reviews_mistakes # Added because it was a mistake despite being recent

    print("✅ Spiraling Engine Tests Passed")

if __name__ == "__main__":
    test_skill_graph()
    test_spiraling_engine()
