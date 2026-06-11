import asyncio
from app.mcp.tools.get_products_tool import get_all_products
import json

async def test():
    print("Fetching products...")
    data = get_all_products()
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    asyncio.run(test())
