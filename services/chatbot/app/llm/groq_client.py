# app/llm/groq_client.py
# ----------------------
# Factory for Groq Chat model via LangChain.
from langchain_groq import ChatGroq
from app.settings import settings

def get_llm():
    """
    Returns a configured LangChain ChatGroq instance.
    Temperature is kept low for stability and safety.
    """
    return ChatGroq(
        groq_api_key=settings.groq_api_key,
        model=settings.llm_model,
        temperature=0.2,
        timeout=45,  # seconds
        max_retries=2,
    )
