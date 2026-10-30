"""
Logging from chat: Viva reads a reading or a daily log out of her message
("today my bp is 118/80") and proposes it. The backend validates the proposal,
shows her a confirm card, and saves it only when she taps Yes. Nothing here
writes to the database.
"""

from app.actions.pipeline import LogActionOutcome, run_log_actions

__all__ = ["LogActionOutcome", "run_log_actions"]
