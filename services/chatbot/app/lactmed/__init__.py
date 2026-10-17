"""LactMed drug-during-lactation lookup layer.

Answers "is <drug> safe while breastfeeding?" questions directly from the
curated NCBI/NIH LactMed dataset (lactmed.json) instead of the vector index.
"""

from app.lactmed.lookup import (
    find_drug,
    format_lactmed_context,
    is_lactation_query,
)

__all__ = ["find_drug", "format_lactmed_context", "is_lactation_query"]
