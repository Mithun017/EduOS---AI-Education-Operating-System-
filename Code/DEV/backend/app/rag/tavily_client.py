import logging
from typing import List, Dict, Any
from tavily import TavilyClient
from app.core.config import settings

logger = logging.getLogger(__name__)

class IsolatedTavilyClient:
    def __init__(self):
        self.api_key = settings.TAVILY_API_KEY
        self._client = None
        if self.api_key and self.api_key != "your_tavily_api_key_here":
            self._client = TavilyClient(api_key=self.api_key)

    def search_external_resources(self, query: str, max_results: int = 3) -> List[Dict[str, str]]:
        """
        Fetches external educational web resources ONLY when explicitly operating in general mode
        or recommending external references. NEVER called for private institutional RAG.
        """
        if not self._client:
            logger.info("Tavily API key not configured. Returning empty external resource list.")
            return []

        try:
            response = self._client.search(query=query, search_depth="basic", max_results=max_results)
            results = []
            for item in response.get("results", []):
                results.append({
                    "title": item.get("title", "External Resource"),
                    "url": item.get("url", ""),
                    "snippet": item.get("content", "")[:200]
                })
            return results
        except Exception as e:
            logger.warning(f"Tavily search failed: {e}")
            return []
