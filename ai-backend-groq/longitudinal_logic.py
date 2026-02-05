import time

class SpiralingEngine:
    def __init__(self, high_decay_days=14):
        self.HIGH_DECAY_MS = high_decay_days * 24 * 60 * 60 * 1000

    def get_review_items(self, phoneme_history, mistakes=None):
        """
        phoneme_history: dict { "m": last_played_timestamp_ms }
        mistakes: list ["m", "p", ...]
        
        Returns a list of unique items to review.
        Priority: 
        1. Recent Mistakes (Immediate Repair)
        2. High Decay Items (Forgetting Curve)
        """
        review_candidates = set()
        current_time = int(time.time() * 1000)

        # 1. Mistakes (High Priority)
        if mistakes:
            for m in mistakes:
                if m: review_candidates.add(m)

        # 2. Decay Analysis
        if phoneme_history:
            for item, last_played in phoneme_history.items():
                if current_time - last_played > self.HIGH_DECAY_MS:
                     review_candidates.add(item)
        
        return list(review_candidates)

class SkillGraph:
    def __init__(self):
        # Directed Acyclic Graph of Dependencies
        self.DEPENDENCIES = {
            # Skill: [Prerequisites that must be MASTERED]
            'blending': ['segmentation'],
            'decoding': ['blending', 'phoneme_identification'],
            'fluency': ['decoding'],
            'reading_comprehension': ['fluency']
        }

    def validate_level_request(self, target_skill, skill_mastery):
        """
        target_skill: str (e.g. "fluency")
        skill_mastery: dict { "decoding": true, "segmentation": true }
        
        Returns: { allowed: bool, bridge_skill: str (optional), missing: str (optional) }
        """
        target_skill = target_skill.lower()
        if target_skill not in self.DEPENDENCIES:
            # If skill not tracked in graph (e.g. 'math'), allow it or logic undefined
            return { 'allowed': True }

        prereqs = self.DEPENDENCIES[target_skill]
        for prereq in prereqs:
            if not skill_mastery.get(prereq, False):
                # Gatekeeping Active: Dependency not met
                return {
                    'allowed': False,
                    'missing': prereq,
                    'bridge_skill': prereq # Suggest working on this instead
                }

        return { 'allowed': True }
