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
        timeout=45, 
        max_retries=2,
    )


def get_classifier_llm():
    """
    Returns a configured LangChain ChatGroq instance.
    Temperature is kept low for stability and safety.
    """
    return ChatGroq(
        groq_api_key=settings.groq_api_key,
        model=settings.scope_classifier_model,
        temperature=0,
        timeout=45, 
        max_retries=2,
        max_tokens=5
    )


