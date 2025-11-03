# app/product/models.py
# ---------------------------------------------------------------------
# PURPOSE (plain English):
# Define a clean Product data model so everything else (tools, ranking,
# responses) knows exactly what fields exist and how to handle them.
#
# We use Pydantic for:
# - Type safety and validation
# - Easy .model_dump() → JSON for LLM/tool outputs
# - Future-proofing (you can add constraints later)
# ---------------------------------------------------------------------

from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, HttpUrl, field_validator


class Product(BaseModel):
    """
    Minimal but practical Product schema for postpartum wellness items.

    Fields:
      id               : Unique ID in your catalog (string works well)
      name             : Human-readable product name
      tags             : Keywords/categories (e.g., ["breast-pump","postpartum"])
      in_stock         : Availability flag (we prefer recommending in-stock items)
      partner          : Vendor tier (e.g., "preferred" has priority in ranking)
      benefits         : Short value proposition (why this product helps)
      usage_note       : Simple guidance on how to use it safely
      contraindications: Optional warnings (keep non-diagnostic)
      url              : Link to product page (optional but useful)
    """

    id: str
    name: str
    tags: List[str]

    in_stock: bool = True
    partner: str = "standard"  # "preferred" will rank higher in our simple scorer

    benefits: Optional[str] = None
    usage_note: Optional[str] = None
    contraindications: Optional[str] = None

    # Optional URL; validated if present
    url: Optional[HttpUrl] = None

    @field_validator("tags")
    @classmethod
    def _tags_lowercase(cls, v: List[str]) -> List[str]:
        """
        Normalize tags to lowercase to make filtering/ranking consistent.
        """
        return [t.lower() for t in v]
